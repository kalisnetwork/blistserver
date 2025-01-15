import fetch from 'node-fetch';
import { googleMapsApiKey } from "../config.js";

// Fetch businesses from Google Places API
export const fetchBusinesses = async (url, query) => {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status === "OK") {
            const results = data.results || [];
            let enhancedResults = await Promise.all(results.map(async (result) => {
                return await _fetchPlaceDetailsAndCombine(result);
            }));
            return enhancedResults;
        } else if (data.status === "ZERO_RESULTS") {
            return [];
        } else {
            throw new Error(`API error! status: ${data.status}`);
        }
    } catch (error) {
        console.log("error:", error);
        throw new Error(`Error fetching data: ${error.message}`);
    }
};

// Helper function to fetch place details and combine with basic data
async function _fetchPlaceDetailsAndCombine(json) {
    let city = null;
    let state = null;
    let country = null;
    let postalCode = null;
    let streetAddress = null;
    const addressComponents = json.address_components || [];
    let sublocality = '';
    let route = '';

    for (const component of addressComponents) {
        const types = component.types || [];
        if (types.includes("sublocality_level_1")) {
            sublocality = component.long_name;
        }
        if (types.includes("locality")) {
            city = component.long_name;
        }
        if (types.includes("administrative_area_level_1")) {
            state = component.long_name;
        }
        if (types.includes("country")) {
            country = component.long_name;
        }
        if (types.includes("postal_code")) {
            postalCode = component.long_name;
        }
        if (types.includes("route")) {
            route = component.long_name;
        }
        if (types.includes("street_address")) {
            streetAddress = component.long_name;
        }
    }

    const location = json.geometry?.location || {};
    const lat = location.lat;
    const lng = location.lng;
    try {
        const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${json.place_id}&fields=formatted_phone_number,opening_hours,website,address_components,types&key=${googleMapsApiKey}`;
        const detailsResponse = await fetch(placeDetailsUrl);
        if (!detailsResponse.ok) {
            throw new Error(`Place Details HTTP error! status: ${detailsResponse.status}`);
        }
        const detailsData = await detailsResponse.json();
        if (detailsData.status === "OK") {
            const details = detailsData.result;
            let detailsCity = city;
            let detailsState = state;
            let detailsCountry = country;
            let detailsPostalCode = postalCode;
            let detailsStreetAddress = streetAddress;
            let detailsSublocality = sublocality;
            let detailsRoute = route;

            const detailsAddressComponents = details.address_components || [];
            for (const component of detailsAddressComponents) {
                const types = component.types || [];
                if (types.includes("sublocality_level_1")) {
                    detailsSublocality = component.long_name;
                }
                if (types.includes("locality")) {
                    detailsCity = component.long_name;
                }
                if (types.includes("administrative_area_level_1")) {
                    detailsState = component.long_name;
                }
                if (types.includes("country")) {
                    detailsCountry = component.long_name;
                }
                if (types.includes("postal_code")) {
                    detailsPostalCode = component.long_name;
                }
                if (types.includes("route")) {
                    detailsRoute = component.long_name;
                }
                if (types.includes("street_address")) {
                    detailsStreetAddress = component.long_name;
                }
            }
            const completeAddress =
                `${detailsStreetAddress || streetAddress ? detailsStreetAddress || streetAddress : ''} ${detailsSublocality || sublocality ? detailsSublocality || sublocality : ''} , ${detailsCity || city ? detailsCity || city : ''}, ${detailsState || state ? detailsState || state : ''}, ${detailsCountry || country ? detailsCountry || country : ''} ${detailsPostalCode || postalCode ? detailsPostalCode || postalCode : ''}`.trim().replace(/,+/g, ',').replace(/\s+/g, ' ');
            const mainCategory = details.types?.find((type) => (type === 'postal_code')) || json.types?.[0];
            return {
                availableServices: json.types?.join(", ") || null,
                bannerImageUrl: json.photos ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${json.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}` : null,
                businessDescription: json.formatted_address || null,
                businessHours: details.opening_hours?.weekday_text?.join('\n') || null,
                businessLogoUrl: null,
                businessName: json.name || null,
                city: detailsCity || city,
                contactEmail: details.website || null,
                contactPerson: null,
                country: detailsCountry || country,
                designation: null,
                galleryImageUrls: null,
                mainCategory: mainCategory || null,
                phoneNumber: details.formatted_phone_number || null,
                postalCode: detailsPostalCode || postalCode,
                state: detailsState || state,
                streetAddress: detailsStreetAddress || streetAddress,
                subCategory: json.types?.[1] || null,
                websiteUrl: details.website || null,
                completeAddress: completeAddress || null,
                placeId: json.place_id
            };
        } else {
            console.log('Error in place details:', detailsData.status);
            const mainCategory = json.types?.find((type) => (type === 'postal_code')) || json.types?.[0];
            const completeAddress = `${streetAddress ? streetAddress : ''} ${sublocality ? sublocality : ''} , ${city ? city : ''}, ${state ? state : ''}, ${country ? country : ''} ${postalCode ? postalCode : ''}`.trim().replace(/,+/g, ',').replace(/\s+/g, ' ');
            return {
                availableServices: json.types?.join(", ") || null,
                bannerImageUrl: json.photos ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${json.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}` : null,
                businessDescription: json.formatted_address || null,
                businessHours: null,
                businessLogoUrl: null,
                businessName: json.name || null,
                city: city || null,
                contactEmail: null,
                contactPerson: null,
                country: country || null,
                designation: null,
                galleryImageUrls: null,
                mainCategory: mainCategory || null,
                phoneNumber: json.formatted_phone_number || null,
                postalCode: postalCode || null,
                state: state || null,
                streetAddress: streetAddress || null,
                subCategory: json.types?.[1] || null,
                websiteUrl: null,
                completeAddress: completeAddress || null,
                placeId: json.place_id
            };
        }
    } catch (error) {
        console.log('error in place details:', error);
        const mainCategory = json.types?.find((type) => (type === 'postal_code')) || json.types?.[0];
        const completeAddress = `${streetAddress ? streetAddress : ''} ${sublocality ? sublocality : ''} , ${city ? city : ''}, ${state ? state : ''}, ${country ? country : ''} ${postalCode ? postalCode : ''}`.trim().replace(/,+/g, ',').replace(/\s+/g, ' ');
        return {
            availableServices: json.types?.join(", ") || null,
            bannerImageUrl: json.photos ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${json.photos[0].photo_reference}&key=${process.env.GOOGLE_MAPS_API_KEY}` : null,
            businessDescription: json.formatted_address || null,
            businessHours: null,
            businessLogoUrl: null,
            businessName: json.name || null,
            city: city || null,
            contactEmail: null,
            contactPerson: null,
            country: country || null,
            designation: null,
            galleryImageUrls: null,
            mainCategory: mainCategory || null,
            phoneNumber: json.formatted_phone_number || null,
            postalCode: postalCode || null,
            state: state || null,
            streetAddress: streetAddress || null,
            subCategory: json.types?.[1] || null,
            websiteUrl: null,
            completeAddress: completeAddress || null,
            placeId: json.place_id
        };
    }
}

// Get latitude and longitude from a postal code
export const getLatLongFromPostalCode = async (postalCode) => {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${postalCode}&key=${googleMapsApiKey}`;
    try {
        const geocodeResponse = await fetch(geocodeUrl);
        if (!geocodeResponse.ok) {
            throw new Error(`Geocode HTTP error! status: ${geocodeResponse.status}`);
        }
        const geocodeData = await geocodeResponse.json();
        if (geocodeData.status === "OK") {
            const result = geocodeData.results[0];
            const location = result.geometry.location;
            return { latitude: location.lat, longitude: location.lng };
        } else {
            throw new Error(`Geocode API error! status: ${geocodeData.status}`);
        }
    } catch (error) {
        console.log('error in Geocode:', error);
        return { latitude: null, longitude: null };
    }
};

// Get latitude and longitude from an area name (e.g., city or neighborhood)
export const getLatLongFromArea = async (area) => {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(area)}&key=${googleMapsApiKey}`;
    try {
        const geocodeResponse = await fetch(geocodeUrl);
        if (!geocodeResponse.ok) {
            throw new Error(`Geocode HTTP error! status: ${geocodeResponse.status}`);
        }
        const geocodeData = await geocodeResponse.json();
        if (geocodeData.status === "OK") {
            const result = geocodeData.results[0];
            const location = result.geometry.location;
            return { latitude: location.lat, longitude: location.lng };
        } else {
            throw new Error(`Geocode API error! status: ${geocodeData.status}`);
        }
    } catch (error) {
        console.log('error in Geocode:', error);
        return { latitude: null, longitude: null };
    }
};

// Apply filters to businesses
export const applyFilters = (businesses, filter) => {
    if (!filter) {
        return businesses;
    }
    try {
        const filterObj = JSON.parse(filter);
        return businesses.filter((business) => {
            for (const key in filterObj) {
                if (filterObj.hasOwnProperty(key)) {
                    const filterValues = filterObj[key];
                    if (filterValues && Array.isArray(filterValues) && filterValues.length > 0) {
                        if (key === "availableServices") {
                            let found = false;
                            for (const filterValue of filterValues) {
                                if (business[key] && business[key].includes(filterValue)) {
                                    found = true;
                                    break;
                                }
                            }
                            if (!found) {
                                return false;
                            }
                        } else if (business[key] == null || !filterValues.includes(business[key])) {
                            return false;
                        }
                    }
                }
            }
            return true;
        });
    } catch (err) {
        console.log('error parsing the filter object:', err);
        return businesses;
    }
};

// Apply sorting to businesses
export const applySorting = (businesses, sort, ascending) => {
    if (!sort) {
        return businesses;
    }
    return [...businesses].sort((a, b) => {
        if (a[sort] == null && b[sort] == null) {
            return 0;
        } else if (a[sort] == null) {
            return 1;
        } else if (b[sort] == null) {
            return -1;
        }
        if (typeof a[sort] === 'string' && typeof b[sort] === 'string') {
            return ascending ? a[sort].localeCompare(b[sort]) : b[sort].localeCompare(a[sort]);
        }
        return ascending ? (a[sort] > b[sort] ? 1 : -1) : (a[sort] < b[sort] ? 1 : -1);
    });
};
