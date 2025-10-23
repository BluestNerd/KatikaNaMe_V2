const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const pdf = require('html-pdf');
const fs = require('fs-extra');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure directories exist
const ensureDirectories = () => {
  const dirs = [
    'uploads/images',
    'uploads/videos',
    'uploads/pdfs',
    'generated/portfolios',
    'generated/pdfs',
    'data'
  ];
  
  dirs.forEach(dir => {
    fs.ensureDirSync(dir);
  });
};

ensureDirectories();

// In-memory storage (replace with database in production)
let artists = [];
let portfolios = [];

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = 'uploads/';
    if (file.mimetype.startsWith('image/')) {
      uploadPath += 'images/';
    } else if (file.mimetype.startsWith('video/')) {
      uploadPath += 'videos/';
    } else {
      uploadPath += 'pdfs/';
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || 
        file.mimetype.startsWith('video/') || 
        file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, videos, and PDFs are allowed.'));
    }
  }
});

// Utility function to generate portfolio HTML
function generatePortfolioHTML(data, template, customizations = {}) {
  const skillsList = Array.isArray(data.skills) ? data.skills : (data.skills || '').split(',').map(s => s.trim());
  const year = new Date().getFullYear();
  
  const colors = customizations.colors || {
    primary: '#B026FF',
    accent: '#FFD23F',
    background: '#0a0a12'
  };

  let html = '';
  
  switch(template) {
    case 'modern':
      html = generateModernTemplate(data, skillsList, colors);
      break;
    case 'classic':
      html = generateClassicTemplate(data, skillsList, colors);
      break;
    case 'artistic':
      html = generateArtisticTemplate(data, skillsList, colors);
      break;
    default:
      html = generateModernTemplate(data, skillsList, colors);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data.name} - ${data.title}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Montserrat:wght@700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: ${colors.primary};
            --accent: ${colors.accent};
            --background: ${colors.background};
            --light: #f5f5f7;
            --text-gray: #a1a1a6;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Poppins', sans-serif;
            background-color: var(--background);
            color: var(--light);
            line-height: 1.6;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
        header {
            background: linear-gradient(135deg, var(--primary), var(--accent));
            color: white;
            padding: 4rem 0;
            text-align: center;
        }
        .profile-img {
            width: 180px;
            height: 180px;
            border-radius: 50%;
            object-fit: cover;
            border: 5px solid var(--accent);
            margin-bottom: 2rem;
        }
        h1 { font-family: 'Montserrat', sans-serif; font-size: 2.5rem; margin-bottom: 1rem; }
        h2 { color: var(--accent); margin: 2rem 0 1rem; }
        section { padding: 2rem 0; }
        .skills { display: flex; flex-wrap: wrap; gap: 10px; }
        .skill {
            background: var(--primary);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.9rem;
        }
        .social-links { display: flex; gap: 15px; margin-top: 1rem; }
        .social-links a {
            color: var(--accent);
            font-size: 1.5rem;
            text-decoration: none;
            transition: color 0.3s;
        }
        .social-links a:hover {
            color: var(--primary);
        }
        footer { text-align: center; padding: 2rem 0; color: var(--text-gray); }
        .section-content { white-space: pre-line; }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;
}

function generateModernTemplate(data, skillsList, colors) {
  return `
    <header>
        <div class="container">
            <img src="https://images.unsplash.com/photo-1583864697784-a0efc8379f70?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" alt="${data.name}" class="profile-img">
            <h1>${data.name}</h1>
            <h3>${data.title}</h3>
            <p>${data.experience} • ${data.location || 'Creative Professional'}</p>
        </div>
    </header>

    <main class="container">
        <section>
            <h2>About Me</h2>
            <div class="section-content">${data.aboutMe}</div>
        </section>

        ${data.jobs ? `
        <section>
            <h2>Experience</h2>
            <div class="section-content">${data.jobs}</div>
        </section>
        ` : ''}

        <section>
            <h2>Skills</h2>
            <div class="skills">
                ${skillsList.map(skill => `<span class="skill">${skill}</span>`).join('')}
            </div>
        </section>

        ${data.services ? `
        <section>
            <h2>Services</h2>
            <div class="section-content">${data.services}</div>
        </section>
        ` : ''}

        ${data.testimonials ? `
        <section>
            <h2>Testimonials</h2>
            <div class="section-content" style="font-style: italic;">${data.testimonials}</div>
        </section>
        ` : ''}

        <section>
            <h2>Connect With Me</h2>
            <div class="social-links">
                ${data.instagram ? `<a href="${data.instagram}" target="_blank"><i class="fab fa-instagram"></i></a>` : ''}
                ${data.youtube ? `<a href="${data.youtube}" target="_blank"><i class="fab fa-youtube"></i></a>` : ''}
                ${data.tiktok ? `<a href="${data.tiktok}" target="_blank"><i class="fab fa-tiktok"></i></a>` : ''}
                ${data.facebook ? `<a href="${data.facebook}" target="_blank"><i class="fab fa-facebook"></i></a>` : ''}
                ${data.twitter ? `<a href="${data.twitter}" target="_blank"><i class="fab fa-twitter"></i></a>` : ''}
                ${data.website ? `<a href="${data.website}" target="_blank"><i class="fas fa-globe"></i></a>` : ''}
            </div>
            <div style="margin-top: 1rem;">
                <p>Email: <a href="mailto:${data.email}" style="color: var(--accent);">${data.email}</a></p>
                ${data.phone ? `<p>Phone: ${data.phone}</p>` : ''}
            </div>
        </section>
    </main>

    <footer>
        <p>&copy; ${new Date().getFullYear()} ${data.name}. All rights reserved.</p>
    </footer>`;
}

function generateClassicTemplate(data, skillsList, colors) {
  return `
    <div class="container">
        <header style="background: none; color: inherit; padding: 2rem 0; text-align: left; border-bottom: 2px solid var(--primary);">
            <div style="display: flex; align-items: center; gap: 2rem;">
                <img src="https://images.unsplash.com/photo-1583864697784-a0efc8379f70?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" 
                     alt="${data.name}" 
                     style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary);">
                <div>
                    <h1 style="margin-bottom: 0.5rem;">${data.name}</h1>
                    <h3 style="color: var(--primary); margin-bottom: 0.5rem;">${data.title}</h3>
                    <p>${data.location || ''}</p>
                </div>
            </div>
        </header>

        <main style="display: grid; grid-template-columns: 2fr 1fr; gap: 3rem; margin-top: 2rem;">
            <div>
                <section>
                    <h2>About Me</h2>
                    <div class="section-content">${data.aboutMe}</div>
                </section>

                ${data.jobs ? `
                <section>
                    <h2>Experience</h2>
                    <div class="section-content">${data.jobs}</div>
                </section>
                ` : ''}

                ${data.services ? `
                <section>
                    <h2>Services</h2>
                    <div class="section-content">${data.services}</div>
                </section>
                ` : ''}
            </div>

            <div>
                <section>
                    <h2>Contact</h2>
                    <p><strong>Email:</strong><br><a href="mailto:${data.email}" style="color: var(--accent);">${data.email}</a></p>
                    ${data.phone ? `<p><strong>Phone:</strong><br>${data.phone}</p>` : ''}
                    
                    <div style="margin-top: 1rem;">
                        <h3>Social Links</h3>
                        <div class="social-links">
                            ${data.instagram ? `<a href="${data.instagram}" target="_blank"><i class="fab fa-instagram"></i></a>` : ''}
                            ${data.youtube ? `<a href="${data.youtube}" target="_blank"><i class="fab fa-youtube"></i></a>` : ''}
                            ${data.tiktok ? `<a href="${data.tiktok}" target="_blank"><i class="fab fa-tiktok"></i></a>` : ''}
                        </div>
                    </div>
                </section>

                <section>
                    <h2>Skills</h2>
                    <div class="skills">
                        ${skillsList.map(skill => `<span class="skill">${skill}</span>`).join('')}
                    </div>
                </section>

                ${data.testimonials ? `
                <section>
                    <h2>Testimonials</h2>
                    <div class="section-content" style="font-size: 0.9rem; font-style: italic;">${data.testimonials}</div>
                </section>
                ` : ''}
            </div>
        </main>
    </div>

    <footer>
        <p>&copy; ${new Date().getFullYear()} ${data.name}. All rights reserved.</p>
    </footer>`;
}

function generateArtisticTemplate(data, skillsList, colors) {
  return `
    <header style="background: linear-gradient(135deg, ${colors.primary}, #540d6e, ${colors.accent}); background-size: 400% 400%; animation: gradient 15s ease infinite; min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center;">
        <style>
            @keyframes gradient {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
        </style>
        <div class="container">
            <img src="https://images.unsplash.com/photo-1583864697784-a0efc8379f70?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80" 
                 alt="${data.name}" 
                 class="profile-img"
                 style="border: 5px solid ${colors.accent}; box-shadow: 0 0 30px rgba(255, 210, 63, 0.5);">
            <h1 style="font-size: 3.5rem; text-shadow: 2px 2px 4px rgba(0,0,0,0.5);">${data.name}</h1>
            <h3 style="font-size: 1.5rem; margin-bottom: 1rem;">${data.title}</h3>
            <p style="font-size: 1.1rem;">${data.experience} Artist • ${data.location || 'Creative Visionary'}</p>
        </div>
    </header>

    <main class="container">
        <section style="text-align: center; padding: 4rem 0;">
            <h2 style="font-size: 2.5rem; margin-bottom: 2rem;">My Artistic Journey</h2>
            <div class="section-content" style="font-size: 1.1rem; line-height: 1.8; max-width: 800px; margin: 0 auto;">
                ${data.aboutMe}
            </div>
        </section>

        ${data.jobs ? `
        <section style="background: rgba(176, 38, 255, 0.1); padding: 3rem; border-radius: 20px; margin: 2rem 0;">
            <h2 style="text-align: center; font-size: 2rem;">Performance History</h2>
            <div class="section-content" style="font-size: 1.1rem;">${data.jobs}</div>
        </section>
        ` : ''}

        <section style="text-align: center;">
            <h2 style="font-size: 2rem;">Artistic Skills</h2>
            <div class="skills" style="justify-content: center; margin-top: 2rem;">
                ${skillsList.map(skill => `<span class="skill" style="background: linear-gradient(135deg, ${colors.primary}, ${colors.accent}); font-size: 1rem; padding: 0.75rem 1.5rem;">${skill}</span>`).join('')}
            </div>
        </section>

        ${data.testimonials ? `
        <section style="text-align: center; padding: 4rem 0;">
            <h2 style="font-size: 2rem;">Voices of Appreciation</h2>
            <div class="section-content" style="font-style: italic; font-size: 1.1rem; max-width: 800px; margin: 0 auto; background: rgba(255, 210, 63, 0.1); padding: 2rem; border-radius: 15px;">
                ${data.testimonials}
            </div>
        </section>
        ` : ''}

        <section style="text-align: center; padding: 3rem 0;">
            <h2 style="font-size: 2rem;">Let's Create Together</h2>
            <div class="social-links" style="justify-content: center; margin: 2rem 0;">
                ${data.instagram ? `<a href="${data.instagram}" target="_blank" style="font-size: 2rem; margin: 0 1rem;"><i class="fab fa-instagram"></i></a>` : ''}
                ${data.youtube ? `<a href="${data.youtube}" target="_blank" style="font-size: 2rem; margin: 0 1rem;"><i class="fab fa-youtube"></i></a>` : ''}
                ${data.tiktok ? `<a href="${data.tiktok}" target="_blank" style="font-size: 2rem; margin: 0 1rem;"><i class="fab fa-tiktok"></i></a>` : ''}
            </div>
            <div>
                <p style="font-size: 1.1rem;">Email: <a href="mailto:${data.email}" style="color: var(--accent); font-weight: bold;">${data.email}</a></p>
                ${data.phone ? `<p style="font-size: 1.1rem;">Phone: ${data.phone}</p>` : ''}
            </div>
        </section>
    </main>

    <footer style="background: rgba(10, 10, 18, 0.8); padding: 2rem 0;">
        <p>&copy; ${new Date().getFullYear()} ${data.name}. All artistic rights reserved.</p>
    </footer>`;
}

// Routes

// Create artist profile
app.post('/api/artists', upload.array('files', 10), async (req, res) => {
  try {
    const {
      name,
      email,
      bio,
      category,
      experience,
      genres,
      location,
      socialLinks
    } = req.body;

    // Validate required fields
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    const artist = {
      id: uuidv4(),
      name,
      email,
      bio: bio || '',
      category: category || 'multi_disciplinary',
      experience: experience || 'beginner',
      genres: genres ? JSON.parse(genres) : [],
      location: location ? JSON.parse(location) : {},
      socialLinks: socialLinks ? JSON.parse(socialLinks) : {},
      files: req.files ? req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        path: file.path,
        mimetype: file.mimetype
      })) : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    artists.push(artist);
    
    // Save to file (in production, use database)
    await fs.writeJson('data/artists.json', artists);

    res.status(201).json({
      message: 'Artist profile created successfully',
      artist
    });
  } catch (error) {
    console.error('Error creating artist:', error);
    res.status(500).json({ error: 'Failed to create artist profile' });
  }
});

// Get all artists
app.get('/api/artists', (req, res) => {
  res.json(artists);
});

// Get artist by ID
app.get('/api/artists/:id', (req, res) => {
  const artist = artists.find(a => a.id === req.params.id);
  if (!artist) {
    return res.status(404).json({ error: 'Artist not found' });
  }
  res.json(artist);
});

// Create portfolio
app.post('/api/portfolios', async (req, res) => {
  try {
    const {
      artistId,
      template,
      title,
      description,
      sections,
      customizations
    } = req.body;

    const artist = artists.find(a => a.id === artistId);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const portfolio = {
      id: uuidv4(),
      artistId,
      template: template || 'modern',
      title: title || `${artist.name} Portfolio`,
      description: description || artist.bio,
      sections: sections || [],
      customizations: customizations || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    portfolios.push(portfolio);
    
    // Save to file
    await fs.writeJson('data/portfolios.json', portfolios);

    // Generate HTML file
    const htmlContent = generatePortfolioHTML(
      {
        ...artist,
        ...portfolio,
        skills: artist.genres
      },
      portfolio.template,
      portfolio.customizations
    );

    const htmlFilePath = path.join('generated/portfolios', `${portfolio.id}.html`);
    await fs.writeFile(htmlFilePath, htmlContent);

    portfolio.htmlUrl = `/portfolios/${portfolio.id}.html`;

    res.status(201).json({
      message: 'Portfolio created successfully',
      portfolio
    });
  } catch (error) {
    console.error('Error creating portfolio:', error);
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

// Generate PDF
app.post('/api/portfolios/:id/generate-pdf', async (req, res) => {
  try {
    const portfolio = portfolios.find(p => p.id === req.params.id);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const artist = artists.find(a => a.id === portfolio.artistId);
    if (!artist) {
      return res.status(404).json({ error: 'Artist not found' });
    }

    const htmlContent = generatePortfolioHTML(
      {
        ...artist,
        ...portfolio,
        skills: artist.genres
      },
      portfolio.template,
      portfolio.customizations
    );

    const pdfOptions = {
      format: 'A4',
      border: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in'
      }
    };

    const pdfFilePath = path.join('generated/pdfs', `${portfolio.id}.pdf`);

    await new Promise((resolve, reject) => {
      pdf.create(htmlContent, pdfOptions).toFile(pdfFilePath, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });

    portfolio.pdfUrl = `/pdfs/${portfolio.id}.pdf`;

    res.json({
      message: 'PDF generated successfully',
      downloadUrl: portfolio.pdfUrl
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

// Serve generated files
app.use('/portfolios', express.static('generated/portfolios'));
app.use('/pdfs', express.static('generated/pdfs'));
app.use('/uploads', express.static('uploads'));

// Get all portfolios
app.get('/api/portfolios', (req, res) => {
  const portfoliosWithArtists = portfolios.map(portfolio => {
    const artist = artists.find(a => a.id === portfolio.artistId);
    return {
      ...portfolio,
      artist: artist ? { name: artist.name, email: artist.email } : null
    };
  });
  res.json(portfoliosWithArtists);
});

// Get portfolio by ID
app.get('/api/portfolios/:id', (req, res) => {
  const portfolio = portfolios.find(p => p.id === req.params.id);
  if (!portfolio) {
    return res.status(404).json({ error: 'Portfolio not found' });
  }

  const artist = artists.find(a => a.id === portfolio.artistId);
  res.json({
    ...portfolio,
    artist: artist ? { name: artist.name, email: artist.email } : null
  });
});

// Load initial data
async function loadInitialData() {
  try {
    if (await fs.pathExists('data/artists.json')) {
      artists = await fs.readJson('data/artists.json');
    }
    if (await fs.pathExists('data/portfolios.json')) {
      portfolios = await fs.readJson('data/portfolios.json');
    }
  } catch (error) {
    console.log('No existing data found, starting fresh...');
  }
}

// Start server
app.listen(PORT, async () => {
  await loadInitialData();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('API endpoints:');
  console.log('  POST   /api/artists');
  console.log('  GET    /api/artists');
  console.log('  GET    /api/artists/:id');
  console.log('  POST   /api/portfolios');
  console.log('  POST   /api/portfolios/:id/generate-pdf');
  console.log('  GET    /api/portfolios');
  console.log('  GET    /api/portfolios/:id');
});
