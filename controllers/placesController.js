import { googleMapsApiKey } from '../config.js';
import { fetchBusinesses, applyFilters, applySorting } from '../utils/apiUtils.js';

// Function to get latitude and longitude from a postal code
const getLatLongFromPostalCode = async (postalCode) => {
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${postalCode}&key=${googleMapsApiKey}`;
  try {
    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { latitude: location.lat, longitude: location.lng };
    } else {
      throw new Error(`Geocode API error! status: ${data.status}`);
    }
  } catch (error) {
    console.error('Error fetching geocode data:', error);
    throw new Error('Failed to fetch geocode data');
  }
};

// Function to get latitude and longitude from an area
const getLatLongFromArea = async (area) => {
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${area}&key=${googleMapsApiKey}`;
  try {
    const response = await fetch(geocodeUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { latitude: location.lat, longitude: location.lng };
    } else {
      throw new Error(`Geocode API error! status: ${data.status}`);
    }
  } catch (error) {
    console.error('Error fetching geocode data:', error);
    throw new Error('Failed to fetch geocode data');
  }
};

const fetchAndFilterBusinesses = async (queryUrl, postalCode, area, businessName, query) => {
  console.log(`Query URL: ${queryUrl}`);
  let businesses = await fetchBusinesses(queryUrl, query);
  console.log(`Fetched businesses: ${JSON.stringify(businesses)}`);
  
  if (postalCode || area || businessName) {
    businesses = businesses.filter(business => {
      const matchesPostalCode = postalCode ? business.postalCode === postalCode : true;
      const matchesArea = area ? business.completeAddress?.toLowerCase().includes(area.toLowerCase()) : true;
      const matchesBusinessName = businessName ? business.businessName?.toLowerCase().includes(businessName.toLowerCase()) : true;
      
      console.log(`Business: ${business.businessName}, Matches Postal Code: ${matchesPostalCode}, Matches Area: ${matchesArea}, Matches Business Name: ${matchesBusinessName}`);
      return matchesPostalCode && matchesArea && matchesBusinessName;
    });
  }
  return businesses;
};

const textSearch = async (req, res) => {
  const { businessName, area, postalCode, filter, sort, ascending, query } = req.query;
  try {
    let searchQuery = [];
    let latitude, longitude;
    let businesses = [];

    if ((area || postalCode) && !businessName && !query) {
      if (area) {
        const coordinates = await getLatLongFromArea(area);
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
        console.log(`Coordinates for area: ${latitude}, ${longitude}`);
      } else if (postalCode) {
        const coordinates = await getLatLongFromPostalCode(postalCode);
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
        console.log(`Coordinates for postal code: ${latitude}, ${longitude}`);
      }
      let queryUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=1000&type=business&key=${googleMapsApiKey}`;
      businesses = await fetchBusinesses(queryUrl, query);
    } else {
      if (postalCode) {
        const coordinates = await getLatLongFromPostalCode(postalCode);
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
        console.log(`Coordinates for postal code: ${latitude}, ${longitude}`);
        searchQuery.push(`postal code ${postalCode}`);
      }
      if (businessName) {
        searchQuery.push(businessName);
      }
      if (area) {
        const coordinates = await getLatLongFromArea(area);
        latitude = coordinates.latitude;
        longitude = coordinates.longitude;
        console.log(`Coordinates for area: ${latitude}, ${longitude}`);
        searchQuery.push(area);
      }
      if (query) {
        searchQuery.push(query);
      }

      if (searchQuery.length === 0) {
        return res.status(400).json({ error: 'Missing search parameters' });
      }

      searchQuery = searchQuery.join(' ');
      console.log(`Search query: ${searchQuery}`);
      let queryUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${searchQuery}&key=${googleMapsApiKey}`;
      if (latitude && longitude) {
        queryUrl += `&location=${latitude},${longitude}&radius=1000`;
      }
      businesses = await fetchAndFilterBusinesses(queryUrl, postalCode, area, businessName, query);
    }

    if (filter) {
      businesses = applyFilters(businesses, filter);
    }
    if (sort) {
      businesses = applySorting(businesses, sort, ascending === 'true');
    }

    res.json(businesses);
  } catch (error) {
    console.error('Error fetching text search results:', error);
    res.status(500).json({ error: 'Failed to fetch text search results' });
  }
};

const nearbySearch = async (req, res) => {
  const { latitude, longitude, radius, filter, sort, ascending, query } = req.query;
  if (!latitude || !longitude || !radius) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    let businesses = await fetchBusinesses(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=business&key=${googleMapsApiKey}`,
      query
    );
    if (filter) {
      businesses = applyFilters(businesses, filter);
    }
    if (sort) {
      businesses = applySorting(businesses, sort, ascending === 'true');
    }
    res.json(businesses);
  } catch (error) {
    console.error('Error fetching nearby search results:', error);
    res.status(500).json({ error: 'Failed to fetch nearby search results' });
  }
};

export default {
  textSearch,
  nearbySearch
};
