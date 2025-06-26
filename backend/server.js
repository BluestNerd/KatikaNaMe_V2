// ===== SERVER.JS - COMPLETE BACKEND FOR KATIKANAME =====
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:8080', 'http://localhost:5500'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: 'Too many upload requests, please slow down.' }
});

app.use('/api/', generalLimiter);

// ===== DATABASE MODELS =====

// Artist Schema
const artistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  bio: { type: String, required: true },
  category: { 
    type: String, 
    required: true,
    enum: ['dancer', 'musician', 'visual_artist', 'multi_disciplinary']
  },
  experience: {
    type: String,
    required: true,
    enum: ['beginner', 'intermediate', 'advanced', 'professional']
  },
  genres: [String],
  location: {
    city: String,
    country: String
  },
  socialLinks: {
    instagram: String,
    youtube: String,
    tiktok: String,
    facebook: String,
    twitter: String,
    website: String
  },
  media: [{
    filename: String,
    originalName: String,
    url: String,
    type: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  portfolio: { type: mongoose.Schema.Types.ObjectId, ref: 'Portfolio' },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  views: { type: Number, default: 0 },
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Portfolio Schema
const portfolioSchema = new mongoose.Schema({
  artist: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true },
  title: { type: String, required: true },
  description: String,
  template: { 
    type: String, 
    enum: ['modern', 'classic', 'artistic'],
    default: 'modern'
  },
  sections: [{
    type: { type: String, required: true },
    title: String,
    content: String,
    media: [String],
    order: Number
  }],
  customizations: {
    colors: {
      primary: { type: String, default: '#B026FF' },
      secondary: { type: String, default: '#ffffff' },
      accent: { type: String, default: '#FFD23F' }
    },
    fonts: {
      heading: { type: String, default: 'Montserrat' },
      body: { type: String, default: 'Poppins' }
    },
    layout: { type: String, default: 'grid' }
  },
  generatedFiles: [{
    format: String,
    filename: String,
    url: String,
    generatedAt: { type: Date, default: Date.now }
  }],
  isPublic: { type: Boolean, default: true },
  views: { type: Number, default: 0 }
}, {
  timestamps: true
});

const Artist = mongoose.model('Artist', artistSchema);
const Portfolio = mongoose.model('Portfolio', portfolioSchema);

// ===== FILE UPLOAD CONFIGURATION =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, 'uploads', 'artists');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, videos, and PDFs are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10 // Max 10 files
  }
});

// ===== ROUTES =====

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    const artistCount = await Artist.countDocuments({ isActive: true });
    const portfolioCount = await Portfolio.countDocuments();
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: { status: dbStatus, artists: artistCount, portfolios: portfolioCount },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', message: error.message });
  }
});

// ===== ARTIST ROUTES =====

// Create artist
app.post('/api/artists', uploadLimiter, upload.array('files', 10), async (req, res) => {
  try {
    const {
      name, email, bio, category, experience, genres, location, socialLinks
    } = req.body;

    // Parse JSON fields
    const parsedGenres = typeof genres === 'string' ? JSON.parse(genres) : genres;
    const parsedLocation = typeof location === 'string' ? JSON.parse(location) : location;
    const parsedSocialLinks = typeof socialLinks === 'string' ? JSON.parse(socialLinks) : socialLinks;

    // Process uploaded files
    const media = req.files?.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      url: `/uploads/artists/${file.filename}`,
      type: file.mimetype
    })) || [];

    const artist = new Artist({
      name,
      email,
      bio,
      category,
      experience,
      genres: parsedGenres,
      location: parsedLocation,
      socialLinks: parsedSocialLinks,
      media
    });

    await artist.save();

    res.status(201).json({
      message: 'Artist created successfully',
      artist: {
        ...artist.toObject(),
        email: undefined // Don't return email in response
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get all artists (public directory)
app.get('/api/artists', async (req, res) => {
  try {
    const { category, location, limit = 20, page = 1 } = req.query;
    
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (location) {
      filter.$or = [
        { 'location.city': new RegExp(location, 'i') },
        { 'location.country': new RegExp(location, 'i') }
      ];
    }

    const artists = await Artist.find(filter)
      .select('-email')
      .populate('portfolio', 'title views')
      .sort({ views: -1, createdAt: -1 })
      .limit(parseInt(limit))
      .skip((page - 1) * limit);

    const total = await Artist.countDocuments(filter);

    res.json({
      artists,
      pagination: {
        current: parseInt(page),
        total: Math.ceil(total / limit),
        hasNext: page * limit < total
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single artist
app.get('/api/artists/:id', async (req, res) => {
  try {
    const artist = await Artist.findById(req.params.id)
      .select('-email')
      .populate('portfolio');
    
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    // Increment views
    artist.views += 1;
    await artist.save();

    res.json({ artist });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PORTFOLIO ROUTES =====

// Create portfolio
app.post('/api/portfolios', async (req, res) => {
  try {
    const { artistId, template, title, description, sections, customizations } = req.body;

    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const portfolio = new Portfolio({
      artist: artistId,
      template: template || 'modern',
      title,
      description,
      sections: sections || [],
      customizations: {
        colors: customizations?.colors || {
          primary: '#B026FF',
          secondary: '#ffffff',
          accent: '#FFD23F'
        },
        fonts: customizations?.fonts || {
          heading: 'Montserrat',
          body: 'Poppins'
        },
        layout: customizations?.layout || 'grid'
      }
    });

    await portfolio.save();

    // Update artist with portfolio reference
    artist.portfolio = portfolio._id;
    await artist.save();

    res.status(201).json({
      message: 'Portfolio created successfully',
      portfolio: await portfolio.populate('artist', 'name email category experience')
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate PDF portfolio
app.post('/api/portfolios/:id/generate-pdf', uploadLimiter, async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id).populate('artist');
    
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    // Ensure uploads directory exists
    const uploadsDir = path.join(__dirname, 'uploads', 'portfolios');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filename = `portfolio-${portfolio._id}-${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);

    // Create PDF document
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      info: {
        Title: portfolio.title,
        Author: portfolio.artist.name,
        Subject: 'Professional Portfolio'
      }
    });

    doc.pipe(fs.createWriteStream(filepath));

    // Helper function to convert hex to RGB
    function hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 176, g: 38, b: 255 };
    }

    const colors = portfolio.customizations?.colors || {
      primary: '#B026FF',
      accent: '#FFD23F'
    };

    const primaryRgb = hexToRgb(colors.primary);
    const accentRgb = hexToRgb(colors.accent);

    // Cover Page
    doc.rect(0, 0, doc.page.width, 200)
       .fill([primaryRgb.r, primaryRgb.g, primaryRgb.b]);

    // Artist name
    doc.fontSize(32)
       .fillColor('white')
       .text(portfolio.artist.name, 50, 80, { align: 'center' });

    doc.fontSize(18)
       .text(portfolio.artist.category?.replace('_', ' ').toUpperCase() || 'CREATIVE PROFESSIONAL', 50, 120, { align: 'center' });

    doc.fontSize(14)
       .text(`${portfolio.artist.experience?.toUpperCase()} LEVEL`, 50, 145, { align: 'center' });

    // Decorative line
    doc.rect(50, 180, doc.page.width - 100, 3)
       .fill([accentRgb.r, accentRgb.g, accentRgb.b]);

    // Portfolio title
    doc.fontSize(24)
       .fillColor([primaryRgb.r, primaryRgb.g, primaryRgb.b])
       .text(portfolio.title, 50, 220)
       .moveDown();

    if (portfolio.description) {
      doc.fontSize(12)
         .fillColor('#333333')
         .text(portfolio.description, 50, doc.y, { 
           align: 'justify',
           width: doc.page.width - 100
         })
         .moveDown(2);
    }

    // About section
    if (portfolio.artist.bio) {
      doc.addPage();
      
      doc.rect(50, 50, doc.page.width - 100, 40)
         .fill([accentRgb.r, accentRgb.g, accentRgb.b]);
      
      doc.fontSize(18)
         .fillColor('white')
         .text('ABOUT THE ARTIST', 60, 65);

      doc.fontSize(12)
         .fillColor('#333333')
         .text(portfolio.artist.bio, 50, 110, {
           align: 'justify',
           width: doc.page.width - 100
         });
    }

    // Portfolio sections
    portfolio.sections.forEach((section) => {
      doc.addPage();
      
      doc.rect(50, 50, doc.page.width - 100, 40)
         .fill([accentRgb.r, accentRgb.g, accentRgb.b]);
      
      doc.fontSize(18)
         .fillColor('white')
         .text((section.title || section.type).toUpperCase(), 60, 65);

      if (section.content) {
        doc.fontSize(12)
           .fillColor('#333333')
           .text(section.content, 50, 110, {
             align: 'justify',
             width: doc.page.width - 100
           });
      }
    });

    // Skills page
    if (portfolio.artist.genres && portfolio.artist.genres.length > 0) {
      doc.addPage();
      
      doc.rect(50, 50, doc.page.width - 100, 40)
         .fill([accentRgb.r, accentRgb.g, accentRgb.b]);
      
      doc.fontSize(18)
         .fillColor('white')
         .text('SKILLS & SPECIALTIES', 60, 65);

      let skillY = 120;
      let skillX = 50;
      
      portfolio.artist.genres.forEach((genre) => {
        const skillWidth = doc.widthOfString(genre) + 20;
        
        if (skillX + skillWidth > doc.page.width - 50) {
          skillX = 50;
          skillY += 35;
        }
        
        doc.rect(skillX, skillY, skillWidth, 25)
           .fill([primaryRgb.r, primaryRgb.g, primaryRgb.b]);
        
        doc.fontSize(10)
           .fillColor('white')
           .text(genre, skillX + 10, skillY + 8);
        
        skillX += skillWidth + 10;
      });
    }

    // Contact page
    doc.addPage();
    
    doc.rect(50, 50, doc.page.width - 100, 40)
       .fill([accentRgb.r, accentRgb.g, accentRgb.b]);
    
    doc.fontSize(18)
       .fillColor('white')
       .text('CONTACT INFORMATION', 60, 65);

    let contactY = 120;

    doc.fontSize(14)
       .fillColor([primaryRgb.r, primaryRgb.g, primaryRgb.b])
       .text('Email:', 50, contactY);
    
    doc.fontSize(12)
       .fillColor('#333333')
       .text(portfolio.artist.email, 50, contactY + 20);

    contactY += 50;

    // Location
    if (portfolio.artist.location?.city || portfolio.artist.location?.country) {
      doc.fontSize(14)
         .fillColor([primaryRgb.r, primaryRgb.g, primaryRgb.b])
         .text('Location:', 50, contactY);
      
      const location = [portfolio.artist.location.city, portfolio.artist.location.country]
        .filter(Boolean).join(', ');
      
      doc.fontSize(12)
         .fillColor('#333333')
         .text(location, 50, contactY + 20);
      
      contactY += 50;
    }

    // Social Media
    if (portfolio.artist.socialLinks) {
      doc.fontSize(14)
         .fillColor([primaryRgb.r, primaryRgb.g, primaryRgb.b])
         .text('Connect Online:', 50, contactY);
      
      contactY += 25;
      
      Object.entries(portfolio.artist.socialLinks).forEach(([platform, url]) => {
        if (url) {
          doc.fontSize(12)
             .fillColor('#0066cc')
             .text(`${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${url}`, 50, contactY);
          contactY += 20;
        }
      });
    }

    // Footer
    doc.fontSize(8)
       .fillColor('#666666')
       .text(
         `Generated by KatikaNaMe Platform • ${new Date().toLocaleDateString()}`,
         50,
         doc.page.height - 30,
         { align: 'center', width: doc.page.width - 100 }
       );

    doc.end();

    // Wait for PDF to be written
    doc.on('end', async () => {
      try {
        const url = `/uploads/portfolios/${filename}`;
        
        portfolio.generatedFiles.push({
          format: 'pdf',
          filename,
          url,
          generatedAt: new Date()
        });
        
        await portfolio.save();

        res.json({
          message: 'Portfolio PDF generated successfully',
          downloadUrl: url,
          filename,
          fileSize: fs.statSync(filepath).size
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to save portfolio file info' });
      }
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get public portfolios
app.get('/api/portfolios/public', async (req, res) => {
  try {
    const { page = 1, limit = 12, category, search } = req.query;
    
    const pipeline = [
      { $match: { isPublic: true } },
      {
        $lookup: {
          from: 'artists',
          localField: 'artist',
          foreignField: '_id',
          as: 'artist'
        }
      },
      { $unwind: '$artist' },
      { $match: { 'artist.isActive': true } }
    ];
    
    if (category) {
      pipeline.push({ $match: { 'artist.category': category } });
    }
    
    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { 'artist.name': { $regex: search, $options: 'i' } },
            { 'title': { $regex: search, $options: 'i' } },
            { 'description': { $regex: search, $options: 'i' } }
          ]
        }
      });
    }
    
    pipeline.push(
      { $sort: { views: -1, createdAt: -1 } },
      { $skip: (page - 1) * parseInt(limit) },
      { $limit: parseInt(limit) },
      {
        $project: {
          title: 1,
          description: 1,
          template: 1,
          views: 1,
          createdAt: 1,
          'artist.name': 1,
          'artist.category': 1,
          'artist.genres': 1,
          'artist.location': 1,
          'artist.media': { $slice: ['$artist.media', 1] }
        }
      }
    );
    
    const portfolios = await Portfolio.aggregate(pipeline);
    
    // Get total count
    const countPipeline = pipeline.slice(0, -3);
    countPipeline.push({ $count: "total" });
    const totalResult = await Portfolio.aggregate(countPipeline);
    const total = totalResult[0]?.total || 0;

    res.json({
      portfolios,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== STATIC FILE SERVING =====
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  console.error('Error:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ error: `${field} already exists`, field });
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large', maxSize: '10MB' });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ===== DATABASE CONNECTION AND SERVER START =====
// ===== DATABASE CONNECTION AND SERVER START =====
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/katikaname';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected successfully');
    
    // Start the server only after DB connection is established
    const server = app.listen(PORT, () => {
      console.log('⏳ Attempting to connect to MongoDB...');  
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🎨 API Base URL: http://localhost:${PORT}/api`);
      console.log(`📁 Uploads: http://localhost:${PORT}/uploads`);
    });

    // Handle server errors
    server.on('error', (error) => {
      console.error('Server error:', error);
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });


// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  mongoose.connection.close(() => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});