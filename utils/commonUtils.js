import { fetchBusinesses } from './apiUtils.js';
import { calculateDistance } from './apiUtils.js';

// Helper function to map Subscription data
export const mapSubscriptionData = (sub) => ({
  price: sub.price || 0,
  billingCycle: sub.billingCycle || 'monthly',
  paymentStatus: sub.paymentStatus || 'incomplete',
  paymentDate: sub.paymentDate ? sub.paymentDate.toDate() : null,
});

// Base business structure
export const createBusinessObject = (business, source, coordinates = null) => ({
  id: business.placeId || business.id || "",
  businessName: business.businessName || business.name || "",
  formatted_address: business.formatted_address || "",
  types: business.types || [],
  placeId: business.placeId || "",
  phoneNumber: business.phoneNumber || "",
  websiteUrl: business.websiteUrl || "",
  businessHours: business.businessHours || "",
  businessLogoUrl: business.businessLogoUrl || "",
  source: source || "",
  contactEmail: business.contactEmail || "",
  availableServices: business.availableServices || "",
  mainCategory: business.mainCategory || "",
  subCategory: business.subCategory || "",
  completeAddress: business.completeAddress || "",
  city: business.city || "",
  state: business.state || "",
  country: business.country || "",
  postalCode: business.postalCode || "",
  streetAddress: business.streetAddress || "",
  contactPerson: business.contactPerson || "",
  designation: business.designation || "",
  businessDescription: business.businessDescription || "",
  photos: business.photos || [],
  galleryImageUrls: business.galleryImageUrls || [],
  bannerImageUrl: business.bannerImageUrl || "",
  rating: business.rating || 0,
  user_ratings_total: business.user_ratings_total || 0,
  geometry: business.geometry || {
    location: { lat: 0, lng: 0 },
    viewport: { northeast: { lat: 0, lng: 0 }, southwest: { lat: 0, lng: 0 } }
  },
  distance: coordinates ? calculateDistance(
    parseFloat(coordinates.latitude),
    parseFloat(coordinates.longitude),
    business.geometry?.location?.lat,
    business.geometry?.location?.lng
  ) : null,
  openNow: business.openNow || false,
  subscriptions: business.subscriptions || [],
  pamphlets: business.pamphlets || [],
  offers: business.offers || [],
  gst: business.gst || null,
  listedBy: business.listedBy || "",
  pricingInformation: business.pricingInformation || [],
  socialMediaLinks: business.socialMediaLinks || { facebook: "", twitter: "", instagram: "", linkedin: "" }
});

// Function to fetch Google Businesses with radius
export const fetchGoogleBusinessesWithRadius = async (baseUrl, coordinates, radius, limit, offset, existingBusinesses) => {
  let allGoogleBusinesses = existingBusinesses || [];
  let next_page_token;
  let fetchedCount = 0;
  const baseUrlWithRadius = baseUrl + `&location=${coordinates.latitude},${coordinates.longitude}&radius=${radius}` + `&locationbias=circle:${radius}@${coordinates.latitude},${coordinates.longitude}`;

  do {
    let currentUrl = baseUrlWithRadius + (next_page_token ? `&pagetoken=${next_page_token}` : '');
    let googleResponse = await fetchBusinesses(currentUrl);
    if (!googleResponse || googleResponse.results.length === 0) {
      break;
    }
    allGoogleBusinesses = allGoogleBusinesses.concat(googleResponse.results);
    fetchedCount += googleResponse.results.length;
    next_page_token = googleResponse.next_page_token;
    if (next_page_token && fetchedCount >= (parseInt(limit) + parseInt(offset) + 20)) {
      next_page_token = null;
    }
    if (next_page_token) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  } while (next_page_token);

  return allGoogleBusinesses;
};
