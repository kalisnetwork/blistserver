import { googleMapsApiKey } from '../config.js';
import { fetchBusinesses } from '../utils/apiUtils.js';
import { categoryToGooglePlacesMapping } from '../utils/categoryMapping.js';
import { SEARCH_TYPES, SORT_OPTIONS } from '../utils/searchUtils.js';
import { db } from '../utils/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (lat2 == null || lon2 == null || lat1 == null || lon1 == null) {
        return null;
    }

    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const fetchGoogleBusinessesWithQuery = async (baseUrl) => {
    try {
        console.log('Fetching Google Businesses with URL:', baseUrl);
        const googleBusinesses = await fetchBusinesses(baseUrl);
        console.log('Google Businesses Found:', googleBusinesses.length);
        return googleBusinesses;
    } catch (error) {
        console.error('Error fetching Google businesses:', error);
        return [];
    }
};

const advancedSearch = async (req, res) => {
    try {
        const {
            latitude,
            longitude,
            minRating = 0,
            businessStatus,
            sortBy = SORT_OPTIONS.DISTANCE,
            ascending = 'true',
            limit = 20,
            offset = 0,
            query,
            category,
            openNow,
            postalCode,
            ...otherParams
        } = req.query;

        console.log('Search Parameters:', { query, category, postalCode });

        // Construct Google Places API URL
        let baseUrl = 'https://maps.googleapis.com/maps/api/place/textsearch/json?';
        if (query) {
            baseUrl += `query=${encodeURIComponent(query)}`;
        } else if (category) {
            baseUrl += `query=${encodeURIComponent(category)}`;
            if (categoryToGooglePlacesMapping[category]) {
                baseUrl += `&type=${categoryToGooglePlacesMapping[category].type}`;
            }
        } else {
            baseUrl += `query=businesses`;
        }
        baseUrl += `&key=${googleMapsApiKey}`;

        // Fetch Google Businesses
        const allGoogleBusinesses = await fetchGoogleBusinessesWithQuery(baseUrl);

        // Fetch Firebase Businesses
        const querySnapshot = await getDocs(collection(db, 'businessListings'));
        const firebaseBusinesses = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return { 
                id: doc.id, 
                ...data, 
                source: 'Firebase',
                subscriptions: (data.subscriptions || []).map(sub => ({
                    price: sub.price || 0,
                    billingCycle: sub.billingCycle || 'monthly',
                    paymentStatus: sub.paymentStatus || 'incomplete',
                    paymentDate: sub.paymentDate ? sub.paymentDate.toDate() : null,
                })),
                pamphlets: data.pamphlets || [],
                offers: data.offers || []
            };
        });

        // Filter Firebase businesses
        const filteredFirebaseBusinesses = firebaseBusinesses.filter(business => {
            if (!query) return true;
            const lowercaseQuery = query.toLowerCase();
            return (
                business.businessName?.toLowerCase().includes(lowercaseQuery) ||
                business.mainCategory?.toLowerCase().includes(lowercaseQuery) ||
                business.subCategory?.toLowerCase().includes(lowercaseQuery) ||
                business.availableServices?.toLowerCase().includes(lowercaseQuery)
            );
        });

        // Combine businesses
        let businesses = [
            ...allGoogleBusinesses,
            ...filteredFirebaseBusinesses
        ];

        console.log('Businesses before filtering:', businesses.length);

        // Apply postal code filter if specified
        if (postalCode) {
            businesses = businesses.filter(business => 
                business.postalCode && 
                business.postalCode.toLowerCase() === postalCode.toLowerCase()
            );
        }

        // Apply rating filter
        if (minRating > 0) {
            businesses = businesses.filter(business => (business.rating || 0) >= minRating);
        }

        // Apply open now filter
        if (openNow === 'true') {
            businesses = businesses.filter(business => business.openNow === true);
        } else if (openNow === 'false') {
            businesses = businesses.filter(business => business.openNow === false);
        }

        // Sort businesses
        switch (sortBy) {
            case SORT_OPTIONS.DISTANCE:
                businesses.sort((a, b) => {
                    if (a.distance === null && b.distance === null) return 0;
                    if (a.distance === null) return 1;
                    if (b.distance === null) return -1;
                    return ascending === 'true' ? (a.distance - b.distance) : (b.distance - a.distance);
                });
                break;
            case SORT_OPTIONS.RATING:
                businesses.sort((a, b) => 
                    ascending === 'true' 
                        ? ((a.rating || 0) - (b.rating || 0)) 
                        : ((b.rating || 0) - (a.rating || 0))
                );
                break;
        }

        console.log('Businesses after filtering:', businesses.length);

        // Pagination
        const startIndex = parseInt(offset);
        const endIndex = startIndex + parseInt(limit);
        const paginatedBusinesses = businesses.slice(startIndex, endIndex);
        const hasMore = businesses.length > endIndex;

        const response = {
            results: paginatedBusinesses,
            total: businesses.length,
            offset: startIndex,
            limit: parseInt(limit),
            hasMore: hasMore
        };

        res.json(response);
    } catch (error) {
        console.error('Error in advanced search:', error);
        res.status(500).json({ error: 'Failed to fetch search results' });
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
        for (const doc of querySnapshot.docs) {
            const data = doc.data();
            const subscriptions = (data.subscriptions || []).map(sub => ({
                price: sub.price || 0,
                billingCycle: sub.billingCycle || 'monthly',
                paymentStatus: sub.paymentStatus || 'incomplete',
                paymentDate: sub.paymentDate ? sub.paymentDate.toDate() : null,
            }));
            const pamphlets = data.pamphlets || [];
            const offers = data.offers || [];
            listings.push({ id: doc.id, ...data, subscriptions: subscriptions, pamphlets: pamphlets, offers: offers });
        }
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
};