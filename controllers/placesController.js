import { googleMapsApiKey } from '../config.js';
import { fetchBusinesses, applyFilters, applySorting, getLatLongFromPostalCode, getLatLongFromArea } from '../utils/apiUtils.js';
import { categoryToGooglePlacesMapping } from '../utils/categoryMapping.js';
import { SEARCH_TYPES, SORT_OPTIONS } from '../utils/searchUtils.js';
import { db } from '../utils/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

// Helper function to calculate distance between two coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {

  if (lat2 == null || lon2 == null || lat1 == null || lon1 == null) {
      return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
};


const advancedSearch = async (req, res) => {
    try {
        const {
            latitude,
            longitude,
            minRating = 0,
            businessStatus,
             sortBy = SORT_OPTIONS.DISTANCE, // Set default sort to DISTANCE
             ascending = 'true', // Set ascending order as true for closest first
            limit = 20,
            offset = 0,
            includeDetails = 'false',
            query,
            category,
             openNow, // Include openNow in parameters
            ...otherParams
        } = req.query;

        let coordinates = null;
         if (!latitude || !longitude) {
          if (otherParams.area) {
            coordinates = await getLatLongFromArea(otherParams.area);
          } else if (otherParams.postalCode) {
            coordinates = await getLatLongFromPostalCode(otherParams.postalCode);
          }
        } else {
          coordinates = { latitude, longitude };
        }

        if(!coordinates){
           return res.status(400).json({ error: "Coordinates are required" });
        }
        let searchQuery; // Declare searchQuery here
        const radii = [500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
          let allGoogleBusinesses = [];
        const startIndex = parseInt(offset);
        const endIndex = parseInt(offset) + parseInt(limit);
         let currentRadiusIndex = 0;
        if(offset > 0){
           currentRadiusIndex = Math.floor(startIndex / parseInt(limit));
        }

          for(let i = 0; i <= currentRadiusIndex; i++){
              const radius = radii[i];
              // Build the base URL with required parameters
            let baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json?';

            // Ensure we have a query parameter (required for textsearch)
            if (query) {
              searchQuery = query
            } else if (category) {
                // If no direct query, use category as the search term
              searchQuery = `${category}`;
            } else {
                searchQuery = 'businesses'; // fallback
            }
            baseUrl += `query=${encodeURIComponent(searchQuery)}`;

            // Add location and radius
            if (coordinates) {
               baseUrl += `&location=${coordinates.latitude},${coordinates.longitude}&radius=${radius}`;
                baseUrl += `&locationbias=circle:${radius}@${coordinates.latitude},${coordinates.longitude}`
             }

            // Add type if category mapping exists
            if (category && categoryToGooglePlacesMapping[category]) {
              baseUrl += `&type=${categoryToGooglePlacesMapping[category].type}`;
            }

            // Add API key
            baseUrl += `&key=${googleMapsApiKey}`;

            let next_page_token;
            let fetchedCount = 0;
             do {
                    let currentUrl = baseUrl + (next_page_token ? `&pagetoken=${next_page_token}` : '');
                    let googleBusinesses = await fetchBusinesses(currentUrl);

                    if (!googleBusinesses || googleBusinesses.length === 0) {
                        break;
                    }

                    allGoogleBusinesses = allGoogleBusinesses.concat(googleBusinesses);
                    fetchedCount += googleBusinesses.length;
                    next_page_token = googleBusinesses[0]?.next_page_token;
                  if (next_page_token && fetchedCount >= (parseInt(limit) + parseInt(offset) + 20)) {
                        next_page_token = null; // Stop fetching if we have fetched sufficient amount of google results
                    }
                     if (next_page_token) {
                          await new Promise(resolve => setTimeout(resolve, 500));
                     }

            } while (next_page_token);

               await new Promise(resolve => setTimeout(resolve, 200)); // Introduce a delay
           }

        allGoogleBusinesses = allGoogleBusinesses.map(business => ({
            businessName: business.businessName,
            formatted_address: business.formatted_address,
            types: business.types,
            placeId: business.placeId,
            phoneNumber: business.phoneNumber,
            websiteUrl: business.websiteUrl,
            businessHours: business.businessHours,
            photos: business.photos,
            rating: business.rating,
            user_ratings_total: business.user_ratings_total,
            geometry: business.geometry,
            availableServices: business.availableServices,
            mainCategory: business.mainCategory,
            subCategory: business.subCategory,
            completeAddress: business.completeAddress,
            city: business.city,
            state: business.state,
            country: business.country,
            source: 'Google Maps',
            distance: coordinates ? calculateDistance(
                parseFloat(coordinates.latitude),
                parseFloat(coordinates.longitude),
                business.geometry?.location?.lat,
                business.geometry?.location?.lng
            ) : null,
              openNow : business.openNow,
            bannerImageUrl: business.bannerImageUrl,
            subscriptions: [] // default subscription array if not available.
         }));


       // Fetch results from Firestore
         const querySnapshot = await getDocs(collection(db, 'businessListings'));
         const firebaseBusinesses = [];
       querySnapshot.forEach((doc) => {
           const data = doc.data();
          const subscriptions = (data.subscriptions || []).map(sub => ({
              price: sub.price || 0,
               billingCycle: sub.billingCycle || 'monthly',
                paymentStatus: sub.paymentStatus || 'incomplete',
                paymentDate: sub.paymentDate ? sub.paymentDate.toDate() : null,

           }));

         firebaseBusinesses.push({ id: doc.id, ...data, source: 'Firebase', subscriptions: subscriptions });
       });

          // Filter Firebase results based on the provided query or category
        let filteredFirebaseBusinesses = firebaseBusinesses.filter(business =>
           searchQuery ? (
             business.businessName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             business.mainCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             business.subCategory?.toLowerCase().includes(searchQuery.toLowerCase()) ||
             business.availableServices?.toLowerCase().includes(searchQuery.toLowerCase())
           ) : true
       );
       // Calculate distance for Firebase businesses
       if (coordinates) {
         filteredFirebaseBusinesses = await Promise.all(filteredFirebaseBusinesses.map(async business => {
           let lat = business.latitude;
           let lng = business.longitude;

           if ((lat == null || lng == null) && (business.streetAddress || business.city || business.postalCode)) {
             const addressString = `${business.streetAddress ? business.streetAddress + ', ' : ''}${business.city ? business.city + ', ' : ''}${business.postalCode ? business.postalCode : ''}`;
             const geoCode = await getLatLongFromArea(addressString);
             if (geoCode && geoCode.latitude && geoCode.longitude) {
               lat = geoCode.latitude;
               lng = geoCode.longitude;
             }
           }

           return {
              businessName: business.businessName,
                formatted_address: business.formatted_address,
                 types: business.types,
                placeId: business.placeId,
                 phoneNumber: business.phoneNumber,
                websiteUrl: business.websiteUrl,
                 businessHours: business.businessHours,
                 photos: business.photos,
                 rating: business.rating,
                user_ratings_total: business.user_ratings_total,
               geometry: business.geometry,
                  availableServices: business.availableServices,
                mainCategory: business.mainCategory,
               subCategory: business.subCategory,
             completeAddress: business.completeAddress,
             city: business.city,
              state: business.state,
               country: business.country,
               source: business.source,
               businessDescription : business.businessDescription,
                 businessLogoUrl : business.businessLogoUrl,
                contactPerson : business.contactPerson,
                designation : business.designation,
                 galleryImageUrls : business.galleryImageUrls,
                postalCode : business.postalCode,
             distance: calculateDistance(
               parseFloat(coordinates.latitude),
               parseFloat(coordinates.longitude),
               lat,
               lng
             ),
              latitude: lat,
             longitude: lng,
                openNow: business.openNow,
               bannerImageUrl: business.bannerImageUrl,
               subscriptions: business.subscriptions || []
           };
         }));
         // Filter by distance
         filteredFirebaseBusinesses = filteredFirebaseBusinesses.filter(business => {
             return business.distance !== null
         });
       }


         // Combine results, prioritize Firebase first
         let businesses = filteredFirebaseBusinesses.length > 0
            ? [...filteredFirebaseBusinesses, ...allGoogleBusinesses]
            : [...allGoogleBusinesses];


       // De-duplicate by placeId
       const uniqueBusinesses = [];
       const seenPlaceIds = new Set();
       for (const business of businesses) {
           if (business.placeId) {
             if (!seenPlaceIds.has(business.placeId)) {
               uniqueBusinesses.push(business);
               seenPlaceIds.add(business.placeId);
            }
           } else {
           uniqueBusinesses.push(business);
          }
       }

         businesses = uniqueBusinesses;


       // Handle zero results
        if (businesses.length === 0) {
          return res.json({
              results: [],
              total: 0,
            message: "No businesses found matching the search criteria.",
          });
        }

        if (minRating > 0) {
          businesses = businesses.filter(business => (business.rating || 0) >= minRating);
        }
         if (openNow === 'true') {
           businesses = businesses.filter(business => business.openNow === true);
         } else if (openNow === 'false') {
            businesses = businesses.filter(business => business.openNow === false);
         }

        if (businessStatus) {
          businesses = businesses.filter(business => business.businessStatus === businessStatus);
       }

        // Apply sorting
        switch (sortBy) {
          case SORT_OPTIONS.DISTANCE:
            businesses.sort((a, b) => {
              if (a.distance === null && b.distance === null) return 0;
              if (a.distance === null) return 1;
              if (b.distance === null) return -1;
              return ascending === 'true' ?
                (a.distance - b.distance) :
                (b.distance - a.distance);
             });
           break;
          case SORT_OPTIONS.RATING:
              businesses.sort((a, b) => ascending === 'true' ?
               ((a.rating || 0) - (b.rating || 0)) :
               ((b.rating || 0) - (a.rating || 0)));
              break;
          case SORT_OPTIONS.PRICE:
            businesses.sort((a, b) => ascending === 'true' ?
               ((a.priceLevel || 0) - (b.priceLevel || 0)) :
              ((b.priceLevel || 0) - (a.priceLevel || 0)));
             break;
         case SORT_OPTIONS.NAME:
           businesses.sort((a, b) => ascending === 'true' ?
                (a.businessName || '').localeCompare(b.businessName || '') :
                 (b.businessName || '').localeCompare(a.businessName || ''));
               break;
      }


        const paginatedBusinesses = businesses.slice(startIndex, endIndex);
           const hasMore =  businesses.length > endIndex;

        // Format response
        const response = {
             results: paginatedBusinesses,
             total: businesses.length,
              offset: parseInt(offset),
             limit: parseInt(limit),
              hasMore: hasMore
            };

         res.json(response);
     } catch (error) {
        console.error('Error in advanced search:', error);
        res.status(500).json({ error: 'Failed to fetch search results' });
    }
};

const getLatLongByPostalCode = async (req, res) => {
   const { postalCode } = req.query;
    if (!postalCode) {
        return res.status(400).json({ error: 'Postal code is required' });
    }
    try {
        const coordinates = await getLatLongFromPostalCode(postalCode);
       if(coordinates.latitude && coordinates.longitude){
           res.json(coordinates);
       }else{
           res.status(404).send({ error: "No data found for this postal code" });
       }
    } catch (error) {
      console.error('Error fetching coordinates by postal code:', error);
        res.status(500).json({ error: 'Failed to fetch coordinates' });
    }
};

// Search by services
const searchByServices = async (req, res) => {
    const { services, ...otherParams } = req.query;
   req.query = { ...otherParams, keywords: services };
  return advancedSearch(req, res);
};

// Search by rating
const searchByRating = async (req, res) => {
 const { minRating, ...otherParams } = req.query;
 req.query = { ...otherParams, minRating, sortBy: SORT_OPTIONS.RATING };
   return advancedSearch(req, res);
};

const searchNearby = async (req, res) => {
    const { latitude, longitude, category, ...otherParams } = req.query;
   if (!latitude || !longitude) {
       return res.status(400).json({ error: 'Coordinates are required for nearby search' });
   }
     req.query = {
       latitude,
       longitude,
       category,
        ...otherParams
     };
   return advancedSearch(req, res);
};


// Fetch business listings from Firestore
export const getBusinessListings = async (req, res) => {
  try {
      const querySnapshot = await getDocs(collection(db, 'businessListings'));
    const listings = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const subscriptions = (data.subscriptions || []).map(sub => ({
         price: sub.price || 0,
           billingCycle: sub.billingCycle || 'monthly',
            paymentStatus: sub.paymentStatus || 'incomplete',
            paymentDate: sub.paymentDate ? sub.paymentDate.toDate() : null,
      }));
       listings.push({ id: doc.id, ...data, subscriptions: subscriptions });
     });
    res.json(listings);
  } catch (error) {
     console.error('Error fetching business listings:', error);
       res.status(500).json({ error: 'Failed to fetch business listings' });
  }
};

export default {
    advancedSearch,
    searchByServices,
    searchByRating,
    searchNearby,
     getBusinessListings,
     getLatLongByPostalCode,
};