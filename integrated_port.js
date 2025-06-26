/**
 * @swagger
 * /api/portfolios/{id}/generate-pdf:
 *   post:
 *     summary: Generate enhanced PDF portfolio with custom styling
 *     tags: [Portfolios]
 */
router.post('/:id/generate-pdf', async (req, res) => {
    try {
      const portfolio = await Portfolio.findById(req.params.id).populate('artist');
      
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }
  
      // Ensure uploads directory exists
      const uploadsDir = path.join(__dirname, '../uploads/portfolios');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
  
      const filename = `portfolio-${portfolio._id}-${Date.now()}.pdf`;
      const filepath = path.join(uploadsDir, filename);
  
      // Create enhanced PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        info: {
          Title: portfolio.title,
          Author: portfolio.artist.name,
          Subject: 'Professional Portfolio',
          Creator: 'KatikaNaMe Platform'
        }
      });
  
      // Pipe PDF to file
      doc.pipe(fs.createWriteStream(filepath));
  
      // Get colors from customizations
      const colors = portfolio.customizations?.colors || {
        primary: '#B026FF',
        secondary: '#ffffff',
        accent: '#FFD23F'
      };
  
      // Helper function to convert hex to RGB
      function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 176, g: 38, b: 255 };
      }
  
      const primaryRgb = hexToRgb(colors.primary);
      const accentRgb = hexToRgb(colors.accent);
  
      // Cover Page
      doc.rect(0, 0, doc.page.width, 200)
         .fill([primaryRgb.r, primaryRgb.g, primaryRgb.b]);
  
      // Profile section
      doc.fontSize(32)
         .fillColor('white')
         .text(portfolio.artist.name, 50, 80, { align: 'center' });
  
      doc.fontSize(18)
         .text(portfolio.artist.category?.replace('_', ' ').toUpperCase() || 'CREATIVE PROFESSIONAL', 50, 120, { align: 'center' });
  
      doc.fontSize(14)
         .text(`${portfolio.artist.experience?.toUpperCase()} LEVEL`, 50, 145, { align: 'center' });
  
      // Add decorative line
      doc.rect(50, 180, doc.page.width - 100, 3)
         .fill([accentRgb.r, accentRgb.g, accentRgb.b]);
  
      // Portfolio title and description
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
  
      // Artist Bio Section
      if (portfolio.artist.bio) {
        doc.addPage();
        
        // Section header
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
           })
           .moveDown(2);
      }
  
      // Process portfolio sections
      portfolio.sections.forEach((section, index) => {
        doc.addPage();
        
        // Section header with accent color
        doc.rect(50, 50, doc.page.width - 100, 40)
           .fill([accentRgb.r, accentRgb.g, accentRgb.b]);
        
        doc.fontSize(18)
           .fillColor('white')
           .text((section.title || section.type).toUpperCase(), 60, 65);
  
        let yPosition = 110;
  
        if (section.content) {
          doc.fontSize(12)
             .fillColor('#333333')
             .text(section.content, 50, yPosition, {
               align: 'justify',
               width: doc.page.width - 100
             });
          
          yPosition = doc.y + 20;
        }
  
        // Add media placeholders if any
        if (section.media && section.media.length > 0) {
          section.media.forEach((mediaUrl, mediaIndex) => {
            if (yPosition > doc.page.height - 100) {
              doc.addPage();
              yPosition = 50;
            }
            
            doc.rect(50, yPosition, 150, 100)
               .stroke([primaryRgb.r, primaryRgb.g, primaryRgb.b]);
            
            doc.fontSize(10)
               .fillColor([primaryRgb.r, primaryRgb.g, primaryRgb.b])
               .text('Media Content', 60, yPosition + 45, { width: 130, align: 'center' });
            
            yPosition += 120;
          });
        }
      });
  
      // Skills/Genres page
      if (portfolio.artist.genres && portfolio.artist.genres.length > 0) {
        doc.addPage();
        
        doc.rect(50, 50, doc.page.width - 100, 40)
           .fill([accentRgb.r, accentRgb.g, accentRgb.b]);
        
        doc.fontSize(18)
           .fillColor('white')
           .text('SKILLS & SPECIALTIES', 60, 65);
  
        let skillY = 120;
        let skillX = 50;
        
        portfolio.artist.genres.forEach((genre, index) => {
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
  
      // Contact Information page
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
  
      // Social Media Links
      if (portfolio.artist.socialLinks) {
        doc.fontSize(14)
           .fillColor([primaryRgb.r, primaryRgb.g, primaryRgb.b])
           .text('Connect Online:', 50, contactY);
        
        contactY += 25;
        
        Object.entries(portfolio.artist.socialLinks).forEach(([platform, url]) => {
          if (url) {
            doc.fontSize(12)
               .fillColor('#0066cc')
               .text(`${platform.charAt(0).toUpperCase() + platform.slice(1)}: ${url}`, 50, contactY, {
                 link: url,
                 underline: true
               });
            contactY += 20;
          }
        });
      }
  
      // Footer on last page
      doc.fontSize(8)
         .fillColor('#666666')
         .text(
           `Generated by KatikaNaMe Platform • ${new Date().toLocaleDateString()} • www.katikaname.com`,
           50,
           doc.page.height - 30,
           { align: 'center', width: doc.page.width - 100 }
         );
  
      // Finalize PDF
      doc.end();
  
      // Wait for PDF to be written
      doc.on('end', async () => {
        try {
          const url = `/uploads/portfolios/${filename}`;
          
          // Save generated file info to portfolio
          portfolio.generatedFiles.push({
            format: 'pdf',
            filename,
            url,
            generatedAt: new Date()
          });
          
          await portfolio.save();
  
          res.json({
            message: 'Enhanced portfolio PDF generated successfully',
            downloadUrl: url,
            filename,
            fileSize: fs.statSync(filepath).size
          });
        } catch (error) {
          res.status(500).json({ error: 'Failed to save portfolio file info' });
        }
      });
  
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * @swagger
   * /api/portfolios/{id}/generate-web:
   *   post:
   *     summary: Generate live web portfolio
   *     tags: [Portfolios]
   */
  router.post('/:id/generate-web', async (req, res) => {
    try {
      const { customDomain } = req.body;
      const portfolio = await Portfolio.findById(req.params.id)
        .populate('artist', '-email');
      
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }
  
      // Generate web portfolio HTML
      const webPortfolioHtml = generateWebPortfolioHTML(portfolio);
      
      // Ensure web portfolios directory exists
      const webDir = path.join(__dirname, '../uploads/web-portfolios');
      if (!fs.existsSync(webDir)) {
        fs.mkdirSync(webDir, { recursive: true });
      }
  
      const domain = customDomain || portfolio.artist.name.toLowerCase().replace(/\s+/g, '-');
      const filename = `${domain}-${Date.now()}.html`;
      const filepath = path.join(webDir, filename);
  
      // Write HTML file
      fs.writeFileSync(filepath, webPortfolioHtml);
  
      const url = `/uploads/web-portfolios/${filename}`;
      
      // Save generated file info to portfolio
      portfolio.generatedFiles.push({
        format: 'html',
        filename,
        url,
        generatedAt: new Date()
      });
      
      await portfolio.save();
  
      res.json({
        message: 'Web portfolio generated successfully',
        liveUrl: `https://${domain}.katikaname.com`,
        previewUrl: url,
        filename,
        domain
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Helper function to generate web portfolio HTML
  function generateWebPortfolioHTML(portfolio) {
    const artist = portfolio.artist;
    const colors = portfolio.customizations?.colors || {
      primary: '#B026FF',
      secondary: '#ffffff',
      accent: '#FFD23F'
    };
    
    return `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${artist.name} - ${portfolio.title}</title>
      <meta name="description" content="${portfolio.description || artist.bio}">
      <meta name="keywords" content="${artist.genres ? artist.genres.join(', ') : ''}">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
      <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Montserrat:wght@700&display=swap" rel="stylesheet">
      <style>
          :root {
              --primary: ${colors.primary};
              --secondary: ${colors.secondary};
              --accent: ${colors.accent};
              --dark: #0a0a12;
              --light: #f5f5f7;
              --text-gray: #a1a1a6;
          }
          
          * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
          }
          
          body {
              font-family: 'Poppins', sans-serif;
              background-color: var(--dark);
              color: var(--light);
              line-height: 1.6;
          }
          
          .container {
              max-width: 1200px;
              margin: 0 auto;
              padding: 0 20px;
          }
          
          /* Header Styles */
          header {
              background: linear-gradient(135deg, var(--primary), var(--accent));
              color: white;
              padding: 4rem 0;
              text-align: center;
              position: relative;
              overflow: hidden;
          }
          
          header::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="2" fill="white" opacity="0.1"/></svg>') repeat;
              animation: float 20s infinite linear;
          }
          
          @keyframes float {
              0% { transform: translateY(0) rotate(0deg); }
              100% { transform: translateY(-100px) rotate(360deg); }
          }
          
          .profile {
              position: relative;
              z-index: 2;
          }
          
          .profile-img {
              width: 200px;
              height: 200px;
              border-radius: 50%;
              object-fit: cover;
              border: 5px solid var(--accent);
              box-shadow: 0 10px 30px rgba(0,0,0,0.3);
              margin-bottom: 2rem;
          }
          
          h1 {
              font-family: 'Montserrat', sans-serif;
              font-size: 3rem;
              font-weight: 700;
              margin-bottom: 1rem;
              text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          
          .subtitle {
              font-size: 1.3rem;
              margin-bottom: 0.5rem;
              opacity: 0.9;
          }
          
          .experience-badge {
              display: inline-block;
              background: rgba(255,255,255,0.2);
              padding: 0.5rem 1rem;
              border-radius: 25px;
              font-size: 0.9rem;
              margin-top: 1rem;
              backdrop-filter: blur(10px);
          }
          
          /* Navigation */
          nav {
              background: rgba(10, 10, 18, 0.95);
              backdrop-filter: blur(10px);
              position: sticky;
              top: 0;
              z-index: 1000;
              padding: 1rem 0;
          }
          
          nav ul {
              display: flex;
              justify-content: center;
              list-style: none;
              gap: 2rem;
          }
          
          nav a {
              color: var(--light);
              text-decoration: none;
              padding: 0.5rem 1rem;
              border-radius: 25px;
              transition: all 0.3s;
          }
          
          nav a:hover {
              background: var(--primary);
              color: white;
          }
          
          /* Main Content */
          main {
              padding: 4rem 0;
          }
          
          section {
              margin-bottom: 4rem;
              padding: 2rem 0;
          }
          
          h2 {
              font-family: 'Montserrat', sans-serif;
              font-size: 2.5rem;
              color: var(--accent);
              text-align: center;
              margin-bottom: 3rem;
              position: relative;
          }
          
          h2::after {
              content: '';
              position: absolute;
              bottom: -10px;
              left: 50%;
              transform: translateX(-50%);
              width: 80px;
              height: 4px;
              background: linear-gradient(90deg, var(--primary), var(--accent));
              border-radius: 2px;
          }
          
          .content-card {
              background: rgba(26, 26, 36, 0.8);
              padding: 2.5rem;
              border-radius: 15px;
              backdrop-filter: blur(10px);
              border: 1px solid rgba(176, 38, 255, 0.2);
              box-shadow: 0 10px 30px rgba(0,0,0,0.2);
              margin-bottom: 2rem;
              transition: transform 0.3s;
          }
          
          .content-card:hover {
              transform: translateY(-5px);
          }
          
          /* Skills Grid */
          .skills-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 1rem;
              margin-top: 2rem;
          }
          
          .skill-tag {
              background: linear-gradient(135deg, var(--primary), var(--accent));
              color: white;
              padding: 1rem;
              border-radius: 10px;
              text-align: center;
              font-weight: 600;
              box-shadow: 0 5px 15px rgba(176, 38, 255, 0.3);
              transition: transform 0.3s;
          }
          
          .skill-tag:hover {
              transform: scale(1.05);
          }
          
          /* Social Links */
          .social-links {
              display: flex;
              justify-content: center;
              gap: 2rem;
              margin-top: 2rem;
          }
          
          .social-links a {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 60px;
              height: 60px;
              background: linear-gradient(135deg, var(--primary), var(--accent));
              color: white;
              border-radius: 50%;
              font-size: 1.5rem;
              text-decoration: none;
              transition: all 0.3s;
              box-shadow: 0 5px 15px rgba(0,0,0,0.2);
          }
          
          .social-links a:hover {
              transform: translateY(-5px) scale(1.1);
              box-shadow: 0 10px 25px rgba(176, 38, 255, 0.4);
          }
          
          /* Contact Section */
          .contact-info {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
              gap: 2rem;
              margin-top: 2rem;
          }
          
          .contact-item {
              display: flex;
              align-items: center;
              gap: 1rem;
              padding: 1rem;
              background: rgba(176, 38, 255, 0.1);
              border-radius: 10px;
          }
          
          .contact-item i {
              font-size: 1.5rem;
              color: var(--accent);
          }
          
          /* Footer */
          footer {
              background: rgba(26, 26, 36, 0.9);
              padding: 3rem 0 1rem;
              text-align: center;
              border-top: 1px solid rgba(176, 38, 255, 0.2);
          }
          
          .footer-brand {
              font-family: 'Montserrat', sans-serif;
              font-size: 1.5rem;
              margin-bottom: 1rem;
          }
          
          .footer-brand .highlight {
              color: var(--accent);
          }
          
          /* Responsive Design */
          @media (max-width: 768px) {
              h1 { font-size: 2rem; }
              h2 { font-size: 2rem; }
              nav ul { flex-direction: column; align-items: center; }
              .social-links { flex-wrap: wrap; }
              .profile-img { width: 150px; height: 150px; }
          }
          
          /* Smooth Scrolling */
          html {
              scroll-behavior: smooth;
          }
          
          /* Loading Animation */
          .fade-in {
              opacity: 0;
              transform: translateY(30px);
              animation: fadeInUp 0.8s forwards;
          }
          
          @keyframes fadeInUp {
              to {
                  opacity: 1;
                  transform: translateY(0);
              }
          }
      </style>
  </head>
  <body>
      <header>
          <div class="container">
              <div class="profile">
                  ${artist.media && artist.media.length > 0 ? 
                    `<img src="${artist.media[0].url}" alt="${artist.name}" class="profile-img">` :
                    `<div class="profile-img" style="background: linear-gradient(135deg, var(--primary), var(--accent)); display: flex; align-items: center; justify-content: center; font-size: 2rem; color: white;">${artist.name.charAt(0)}</div>`
                  }
                  <h1>${artist.name}</h1>
                  <p class="subtitle">${artist.category?.replace('_', ' ').toUpperCase() || 'CREATIVE PROFESSIONAL'}</p>
                  <div class="experience-badge">
                      ${artist.experience?.toUpperCase()} LEVEL
                      ${artist.location?.city ? ` • ${artist.location.city}${artist.location.country ? ', ' + artist.location.country : ''}` : ''}
                  </div>
              </div>
          </div>
      </header>
  
      <nav>
          <div class="container">
              <ul>
                  <li><a href="#about">About</a></li>
                  <li><a href="#skills">Skills</a></li>
                  ${portfolio.sections.some(s => s.type === 'experience') ? '<li><a href="#experience">Experience</a></li>' : ''}
                  ${portfolio.sections.some(s => s.type === 'gallery') ? '<li><a href="#gallery">Gallery</a></li>' : ''}
                  <li><a href="#contact">Contact</a></li>
              </ul>
          </div>
      </nav>
  
      <main class="container">
          <section id="about" class="fade-in">
              <h2>About Me</h2>
              <div class="content-card">
                  <p style="font-size: 1.1rem; line-height: 1.8;">${artist.bio || portfolio.description}</p>
              </div>
          </section>
  
          ${artist.genres && artist.genres.length > 0 ? `
          <section id="skills" class="fade-in">
              <h2>Skills & Specialties</h2>
              <div class="skills-grid">
                  ${artist.genres.map(genre => `<div class="skill-tag">${genre}</div>`).join('')}
              </div>
          </section>
          ` : ''}
  
          ${portfolio.sections.map(section => `
          <section id="${section.type}" class="fade-in">
              <h2>${section.title || section.type.charAt(0).toUpperCase() + section.type.slice(1)}</h2>
              <div class="content-card">
                  <div style="white-space: pre-line; font-size: 1.1rem; line-height: 1.8;">${section.content}</div>
              </div>
          </section>
          `).join('')}
  
          <section id="contact" class="fade-in">
              <h2>Let's Connect</h2>
              <div class="content-card">
                  <div class="contact-info">
                      <div class="contact-item">
                          <i class="fas fa-envelope"></i>
                          <div>
                              <strong>Email</strong><br>
                              <a href="mailto:${artist.email}" style="color: var(--accent);">${artist.email}</a>
                          </div>
                      </div>
                      ${artist.location?.city ? `
                      <div class="contact-item">
                          <i class="fas fa-map-marker-alt"></i>
                          <div>
                              <strong>Location</strong><br>
                              ${artist.location.city}${artist.location.country ? ', ' + artist.location.country : ''}
                          </div>
                      </div>
                      ` : ''}
                  </div>
                  
                  ${artist.socialLinks ? `
                  <div class="social-links">
                      ${Object.entries(artist.socialLinks).map(([platform, url]) => 
                        url ? `<a href="${url}" target="_blank" title="${platform}">
                          <i class="fab fa-${platform === 'website' ? 'globe' : platform}"></i>
                        </a>` : ''
                      ).join('')}
                  </div>
                  ` : ''}
              </div>
          </section>
      </main>
  
      <footer>
          <div class="container">
              <div class="footer-brand">
                  <span>Katika</span><span class="highlight">NaMe</span>
              </div>
              <p>&copy; ${new Date().getFullYear()} ${artist.name}. All rights reserved.</p>
              <p style="color: var(--text-gray); font-size: 0.9rem; margin-top: 1rem;">
                  Powered by KatikaNaMe Platform
              </p>
          </div>
      </footer>
  
      <script>
          // Smooth scrolling for navigation links
          document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
              anchor.addEventListener('click', function (e) {
                  e.preventDefault();
                  const target = document.querySelector(this.getAttribute('href'));
                  if (target) {
                      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
              });
          });
  
          // Fade in animation on scroll
          const observerOptions = {
              threshold: 0.1,
              rootMargin: '0px 0px -50px 0px'
          };
  
          const observer = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                  if (entry.isIntersecting) {
                      entry.target.style.animationDelay = '0.2s';
                      entry.target.classList.add('fade-in');
                  }
              });
          }, observerOptions);
  
          document.querySelectorAll('.fade-in').forEach(el => {
              observer.observe(el);
          });
  
          // Add loading state
          window.addEventListener('load', () => {
              document.body.style.opacity = '1';
          });
      </script>
  </body>
  </html>`;
  }
  
  /**
   * @swagger
   * /api/portfolios/public:
   *   get:
   *     summary: Get public portfolios for gallery/directory
   *     tags: [Portfolios]
   */
  router.get('/public', async (req, res) => {
    try {
      const { page = 1, limit = 12, category, search } = req.query;
      
      const filter = { isPublic: true };
      
      // Build aggregation pipeline for advanced filtering
      const pipeline = [
        { $match: filter },
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
      
      // Add category filter
      if (category) {
        pipeline.push({ $match: { 'artist.category': category } });
      }
      
      // Add search functionality
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { 'artist.name': { $regex: search, $options: 'i' } },
              { 'title': { $regex: search, $options: 'i' } },
              { 'description': { $regex: search, $options: 'i' } },
              { 'artist.genres': { $in: [new RegExp(search, 'i')] } }
            ]
          }
        });
      }
      
      // Add sorting and pagination
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
            'artist.media': { $slice: ['$artist.media', 1] } // Just first image
          }
        }
      );
      
      // Get total count for pagination
      const countPipeline = pipeline.slice(0, -3); // Remove sort, skip, limit, project
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
  
  /**
   * @swagger
   * /api/portfolios/{id}/analytics:
   *   get:
   *     summary: Get portfolio analytics and stats
   *     tags: [Portfolios]
   */
  router.get('/:id/analytics', async (req, res) => {
    try {
      const portfolio = await Portfolio.findById(req.params.id)
        .populate('artist', 'name email');
      
      if (!portfolio) {
        return res.status(404).json({ error: 'Portfolio not found' });
      }
  
      // Calculate analytics
      const analytics = {
        views: portfolio.views,
        generatedFiles: portfolio.generatedFiles.length,
        lastUpdated: portfolio.updatedAt,
        createdAt: portfolio.createdAt,
        sectionsCount: portfolio.sections.length,
        isPublic: portfolio.isPublic,
        template: portfolio.template,
        filesGenerated: {
          pdf: portfolio.generatedFiles.filter(f => f.format === 'pdf').length,
          html: portfolio.generatedFiles.filter(f => f.format === 'html').length
        },
        recentActivity: portfolio.generatedFiles
          .sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt))
          .slice(0, 5)
      };
  
      res.json({ analytics });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  module.exports = router;
  
  // ===== ENHANCED ROUTES/ARTISTS.JS (Additional Features) =====
  // Add these endpoints to the existing artists router
  
  /**
   * @swagger
   * /api/artists/directory:
   *   get:
   *     summary: Get featured artists for public directory
   *     tags: [Artists]
   */
  router.get('/directory', async (req, res) => {
    try {
      const { category, location, featured = false, limit = 20 } = req.query;
      
      const filter = { 
        isActive: true,
        isVerified: true 
      };
      
      if (category) filter.category = category;
      if (location) {
        filter.$or = [
          { 'location.city': new RegExp(location, 'i') },
          { 'location.country': new RegExp(location, 'i') }
        ];
      }
      
      let sort = { 'rating.average': -1, createdAt: -1 };
      if (featured === 'true') {
        sort = { views: -1, 'rating.average': -1 };
      }
  
      const artists = await Artist.find(filter)
        .select('name category experience location genres media rating portfolio createdAt')
        .populate('portfolio', 'title views template')
        .sort(sort)
        .limit(parseInt(limit));
  
      res.json({
        artists: artists.map(artist => ({
          ...artist.toObject(),
          email: undefined // Remove email from public listing
        }))
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  /**
   * @swagger
   * /api/artists/stats:
   *   get:
   *     summary: Get platform statistics
   *     tags: [Artists]
   */
  router.get('/stats', async (req, res) => {
    try {
      const [
        totalArtists,
        verifiedArtists,
        categoryCounts,
        locationCounts,
        recentJoins
      ] = await Promise.all([
        Artist.countDocuments({ isActive: true }),
        Artist.countDocuments({ isActive: true, isVerified: true }),
        Artist.aggregate([
          { $match: { isActive: true } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
          { $sort: { count: -1 } }
        ]),
        Artist.aggregate([
          { $match: { isActive: true, 'location.country': { $exists: true } } },
          { $group: { _id: '$location.country', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ]),
        Artist.countDocuments({
          isActive: true,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        })
      ]);
  
      res.json({
        stats: {
          totalArtists,
          verifiedArtists,
          recentJoins,
          verificationRate: Math.round((verifiedArtists / totalArtists) * 100),
          categoryCounts,
          topLocations: locationCounts
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // ===== ENHANCED SERVER.JS (Additional Middleware) =====
  // Add these to your existing server.js
  
  // Middleware for file serving with proper headers
  app.use('/uploads', (req, res, next) => {
    // Set appropriate headers for different file types
    const ext = path.extname(req.path).toLowerCase();
    
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    } else if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day cache
    } else if (ext === '.html') {
      res.setHeader('Content-Type', 'text/html');
    }
    
    next();
  }, express.static('uploads'));
  
  // Health check with detailed info
  app.get('/health', async (req, res) => {
    try {
      // Check database connection
      const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
      
      // Check disk space for uploads
      const uploadsPath = path.join(__dirname, 'uploads');
      const uploadsDirExists = fs.existsSync(uploadsPath);
      
      // Get basic stats
      const artistCount = await Artist.countDocuments({ isActive: true });
      const portfolioCount = await Portfolio.countDocuments();
      
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.0',
        database: {
          status: dbStatus,
          artists: artistCount,
          portfolios: portfolioCount
        },
        storage: {
          uploadsDirectory: uploadsDirExists
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
        }
      });
    } catch (error) {
      res.status(500).json({
        status: 'ERROR',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // ===== API RATE LIMITING CONFIGURATION =====
  const createRateLimit = require('express-rate-limit');
  
  // Different rate limits for different endpoints
  const authLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs for auth
    message: {
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: 15
    }
  });
  
  const uploadLimiter = createRateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 upload requests per minute
    message: {
      error: 'Too many upload requests, please slow down.',
      retryAfter: 1
    }
  });
  
  const generalLimiter = createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per 15 minutes
    message: {
      error: 'Too many requests, please try again later.',
      retryAfter: 15
    }
  });
  
  // Apply rate limiting
  app.use('/api/admin/login', authLimiter);
  app.use('/api/artists', uploadLimiter);
  app.use('/api/portfolios/:id/generate-pdf', uploadLimiter);
  app.use('/api/', generalLimiter);
  
  // ===== ENHANCED ERROR HANDLING =====
  const createError = (status, message, code = null) => {
    const error = new Error(message);
    error.status = status;
    error.code = code;
    return error;
  };
  
  // Enhanced error handling middleware
  app.use((err, req, res, next) => {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
  
    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
  
    // Mongoose duplicate key error
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue)[0];
      return res.status(400).json({
        error: `${field} already exists`,
        field
      });
    }
  
    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token'
      });
    }
  
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired'
      });
    }
  
    // File upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large',
        maxSize: '10MB'
      });
    }
  
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Too many files or unexpected field name'
      });
    }
  
    // Default error response
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { 
        stack: err.stack,
        details: err 
      })
    });
  });
  
  // ===== DEPLOYMENT CONFIGURATION =====
  
  // Production optimizations
  if (process.env.NODE_ENV === 'production') {
    // Trust proxy
    app.set('trust proxy', 1);
    
    // Secure headers
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
          scriptSrc: ["'self'", "https://cdnjs.cloudflare.com"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: ["'self'"]
        }
      },
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
  }
  
  // ===== PACKAGE.JSON ADDITIONS =====
  // Add these scripts to your package.json:
  /*
  {
    "scripts": {
      "start": "node server.js",
      "dev": "nodemon server.js",
      "test": "jest",
      "test:watch": "jest --watch",
      "lint": "eslint .",
      "lint:fix": "eslint . --fix",
      "seed": "node scripts/seed.js",
      "build": "echo 'Build completed'",
      "postinstall": "npm run seed"
    }
  }
  */
  
  // ===== VERCEL.JSON CONFIGURATION =====
  /*
  {
    "version": 2,
    "builds": [
      {
        "src": "server.js",
        "use": "@vercel/node"
      }
    ],
    "routes": [
      {
        "src": "/(.*)",
        "dest": "/server.js"
      }
    ],
    "env": {
      "NODE_ENV": "production"
    }
  }
  */
  
  // ===== RENDER.COM CONFIGURATION =====
  /*
  # render.yaml
  services:
    - type: web
      name: katikaname-backend
      env: node
      buildCommand: npm install
      startCommand: npm start
      envVars:
        - key: NODE_ENV
          value: production
        - key: MONGODB_URI
          fromDatabase:
            name: katikaname-db
            property: connectionString
        - key: JWT_SECRET
          generateValue: true
        - key: FRONTEND_URL
          value: https://your-frontend-domain.com
  
  databases:
    - name: katikaname-db
      databaseName: katikaname
      user: katikaname
  */// ===== ENHANCED ROUTES/PORTFOLIOS.JS =====
  const express = require('express');
  const PDFDocument = require('pdfkit');
  const fs = require('fs');
  const path = require('path');
  const Portfolio = require('../models/Portfolio');
  const Artist = require('../models/Artist');
  const router = express.Router();
  
  /**
   * @swagger
   * /api/portfolios:
   *   post:
   *     summary: Create a new portfolio with enhanced template support
   *     tags: [Portfolios]
   */
  router.post('/', async (req, res) => {
    try {
      const { artistId, template, title, description, sections, customizations } = req.body;
  
      // Verify artist exists
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
  
  /**
   * @swagger
   * /api/portfolios/{id}/generate-pdf: