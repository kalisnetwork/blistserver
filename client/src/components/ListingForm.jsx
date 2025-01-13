// src/components/ListingForm.jsx
import React, { useState, useEffect } from 'react';
import {
  TextField,
  Button,
  Box,
  Typography,
  Grid,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Paper,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { useAuth } from './FirebaseAuth';
import { useNavigate } from 'react-router-dom';
import { createNewListing, fetchUserDetails } from '../services/api';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../config/firebase.config';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);


const ListingForm = () => {
  const [formData, setFormData] = useState({
    businessName: '',
    mainCategory: '',
    subCategory: '',
    availableServices: '',
    businessDescription: '',
    businessHours: '',
    contactPerson: '',
    designation: '',
    phoneNumber: '',
    streetAddress: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'IN',
    contactEmail: '',
    websiteUrl: '',
    listedBy: '',
    bannerImageUrl: null,
    businessLogoUrl: null,
    galleryImageUrls: [],
    paymentStatus: 'incomplete',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { currentUser } = useAuth();

    const handleChange = (e) => {
        const { name, value, type } = e.target;
        if (type === 'file') {
            if (name === "galleryImageUrls"){
                setFormData({...formData, galleryImageUrls: Array.from(e.target.files) })
            } else {
                setFormData({ ...formData, [name]: e.target.files[0] });
            }
        }  else {
            setFormData({ ...formData, [name]: value });
        }
    };

     const handleGalleryImages = (e) => {
       setFormData({...formData, galleryImageUrls: Array.from(e.target.files)})
      };
      useEffect(() => {
        if (currentUser) {
          console.log("Current User UID:", currentUser.uid);
          setFormData(prevFormData => ({
            ...prevFormData,
            listedBy: currentUser.uid
          }));
        }
      }, [currentUser]);

  const uploadImages = async () => {
      const uploadPromises = [];
        const storageRef = ref(storage, `businessListings/${Date.now()}`);
        if (formData.bannerImageUrl) {
           const bannerRef = ref(storage, `${storageRef.fullPath}/banner_${formData.bannerImageUrl.name}`);
         uploadPromises.push(uploadBytes(bannerRef, formData.bannerImageUrl).then(snapshot => getDownloadURL(snapshot.ref)));
        }
         if (formData.businessLogoUrl) {
             const logoRef = ref(storage, `${storageRef.fullPath}/logo_${formData.businessLogoUrl.name}`);
            uploadPromises.push(uploadBytes(logoRef, formData.businessLogoUrl).then(snapshot => getDownloadURL(snapshot.ref)));
        }

        if (formData.galleryImageUrls && formData.galleryImageUrls.length > 0) {
           formData.galleryImageUrls.forEach(file => {
               const galleryRef = ref(storage, `${storageRef.fullPath}/gallery_${file.name}`);
               uploadPromises.push(uploadBytes(galleryRef, file).then(snapshot => getDownloadURL(snapshot.ref)))
           })
        }

      return await Promise.all(uploadPromises)
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const userId = currentUser?.uid;
  
    if (!userId) {
      setError("User not logged in");
      return;
    }
    setLoading(true);
    try {
      const imageUrls = await uploadImages();
      let bannerUrl = null;
      let logoUrl = null;
      let galleryUrls = [];
  
      if (formData.bannerImageUrl) {
        bannerUrl = imageUrls.shift();
      }
      if (formData.businessLogoUrl) {
        logoUrl = imageUrls.shift();
      }
      if (formData.galleryImageUrls && formData.galleryImageUrls.length > 0) {
        galleryUrls = imageUrls;
      }
  
      const formDataToSend = {
        ...formData,
        listedBy: userId,
        bannerImageUrl: bannerUrl,
        businessLogoUrl: logoUrl,
        galleryImageUrls: galleryUrls
      };
      
      console.log("Data being sent to API:", formDataToSend);
  
      const response = await createNewListing(formDataToSend);
      if (response.success) {
        setSuccess('Listing submitted successfully!');
        setFormData({
          businessName: '',
          mainCategory: '',
          subCategory: '',
          availableServices: '',
          businessDescription: '',
          businessHours: '',
          contactPerson: '',
          designation: '',
          phoneNumber: '',
          streetAddress: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'IN',
          contactEmail: '',
          websiteUrl: '',
          listedBy: '',
          bannerImageUrl: null,
          businessLogoUrl: null,
          galleryImageUrls: [],
          paymentStatus: 'incomplete',
        });
      } else {
        setError("Failed to submit the listing.");
        console.error("Failed to submit the listing ", response.message);
      }
    } catch (e) {
      setError("Failed to submit the listing, check logs.");
      console.error("Failed to submit the listing ", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Business Listing Form
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      {loading && <CircularProgress sx={{ mb: 2 }} />}
      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Business Name"
              name="businessName"
              value={formData.businessName}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="main-category-label">Main Category</InputLabel>
              <Select
                labelId="main-category-label"
                id="mainCategory"
                label="Main Category"
                name="mainCategory"
                value={formData.mainCategory}
                onChange={handleChange}
                required
              >
                <MenuItem value="Restaurant">Restaurant</MenuItem>
                <MenuItem value="Retail">Retail</MenuItem>
                <MenuItem value="Services">Services</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Sub Category"
              name="subCategory"
              value={formData.subCategory}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Available Services (Comma Separated)"
              name="availableServices"
              value={formData.availableServices}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Business Description"
              name="businessDescription"
              value={formData.businessDescription}
              onChange={handleChange}
              fullWidth
              required
              multiline
              rows={3}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Business Hours"
              name="businessHours"
              value={formData.businessHours}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Contact Person"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Designation"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Phone Number"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              fullWidth
              required
              type="tel"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Street Address"
              name="streetAddress"
              value={formData.streetAddress}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="City"
              name="city"
              value={formData.city}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Postal Code"
              name="postalCode"
              value={formData.postalCode}
              onChange={handleChange}
              fullWidth
              required
              type="number"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Country"
              name="country"
              value={formData.country}
              onChange={handleChange}
              fullWidth
              required
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Contact Email"
              name="contactEmail"
              value={formData.contactEmail}
              onChange={handleChange}
              fullWidth
              required
              type="email"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Website URL"
              name="websiteUrl"
              value={formData.websiteUrl}
              onChange={handleChange}
              fullWidth
              required
              type="url"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <input
              accept="image/*"
              id="banner-image"
              type="file"
              onChange={handleChange}
              name="bannerImageUrl"
              style={{ display: 'none' }}
            />
            <label htmlFor="banner-image">
              <Button variant="contained" component="span">
                Upload Banner Image
              </Button>
            </label>
          </Grid>
          <Grid item xs={12} sm={6}>
            <input
              accept="image/*"
              id="logo-image"
              type="file"
              onChange={handleChange}
              name="businessLogoUrl"
              style={{ display: 'none' }}
            />
            <label htmlFor="logo-image">
              <Button variant="contained" component="span">
                Upload Business Logo
              </Button>
            </label>
          </Grid>
          <Grid item xs={12}>
            <input
              accept="image/*"
              id="gallery-images"
              type="file"
              onChange={handleGalleryImages}
              multiple
              style={{ display: 'none' }}
            />
            <label htmlFor="gallery-images">
              <Button variant="contained" component="span">
                Upload Gallery Images
              </Button>
            </label>
          </Grid>
            <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.paymentStatus === 'complete'}
                  onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.checked ? 'complete' : 'incomplete' })}
                  name="paymentStatus"
                />
              }
              label="Payment Status"
            />
          </Grid>
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={loading}
            >
              Submit Listing
            </Button>
          </Grid>
        </Grid>
      </form>
    </Paper>
  );
};

export default ListingForm;