// src/index.js
import express from 'express';
import cors from 'cors';
import placesRoutes from './routes/placesRoutes.js';

const app = express();
const port = process.env.PORT || 4444;

app.use(cors());
app.use(express.json());

app.use('/api/places', placesRoutes);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});