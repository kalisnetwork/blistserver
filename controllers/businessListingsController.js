import { db } from '../utils/firebase.js';
import { collection, getDocs } from 'firebase/firestore';
import { createBusinessObject, mapSubscriptionData } from '../utils/commonUtils.js';

export const getBusinessListings = async (req, res) => {
  try {
    const querySnapshot = await getDocs(collection(db, 'businessListings'));
    const listings = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const subscriptions = (data.subscriptions || []).map(mapSubscriptionData);
      const pamphlets = data.pamphlets || [];
      const offers = data.offers || [];
      return {
        ...createBusinessObject(data, 'Firebase'),
        id: doc.id,
        subscriptions: subscriptions,
        pamphlets: pamphlets,
        offers: offers
      };
    });
    res.json(listings);
  } catch (error) {
    console.error('Error fetching business listings:', error);
    res.status(500).json({ error: 'Failed to fetch business listings' });
  }
};

export const getLatLongByPostalCode = async (req, res) => {
  const { postalCode } = req.query;
  if (!postalCode) {
    return res.status(400).json({ error: 'Postal code is required' });
  }
  try {
    const coordinates = await getLatLongByPostalCode(postalCode);
    if (coordinates.latitude && coordinates.longitude) {
      res.json(coordinates);
    } else {
      res.status(404).send({ error: "No data found for this postal code" });
    }
  } catch (error) {
    console.error('Error fetching coordinates by postal code:', error);
    res.status(500).json({ error: 'Failed to fetch coordinates' });
  }
};
