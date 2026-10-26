require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

const links = [
  "https://drive.google.com/file/d/10CDdhWnTBUdFbjBzVPHEWyMD0Ct-EuII/view?usp=sharing",
  "https://drive.google.com/file/d/1KYOxPCA0XdW9elz7VTB0CGIMIKrS4R_W/view?usp=sharing",
  "https://drive.google.com/file/d/1O8nKQQijtqdHlp0RT9WTs_vpOe6xesA6/view?usp=sharing",
  "https://drive.google.com/file/d/1_Fxlc6Oh57ElLv5lEVKyLFJ7nC7Aakdi/view?usp=sharing",
  "https://drive.google.com/file/d/1bWP4mk0bOFLG1n3rEa05UlxTuJk7lFes/view?usp=sharing",
  "https://drive.google.com/file/d/1ctSMN4G1nJAwD__zCh5_HwtudwhsE35z/view?usp=sharing",
  "https://drive.google.com/file/d/1dSNwgv6sHuND7P9Pbl1MStEOdhIy1z9J/view?usp=sharing",
  "https://drive.google.com/file/d/1r4hwXdi6YZah6nz-0LYlr9_quzKi9PsH/view?usp=sharing",
  "https://drive.google.com/file/d/1zYIqDtJ8mE5JnaathpwP4zHrOtpuPoBc/view?usp=sharing"
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (let i = 0; i < links.length; i++) {
    const newFile = new File({
      originalName: `Discrete Mathematics 2019 pattern_${i+1}.pdf`,
      storedName: `google-drive_${Date.now()}_${i}`,
      year: 'second',
      branch: 'Computer Engineering',
      subject: 'Discrete Mathematics 2019 pattern',
      semester: 'any',
      size: 0,
      uploadedBy: 'Synapse07',
      url: links[i].trim(),
      publicId: `google-drive_${Date.now()}_${i}`,
      contentType: 'regular',
      pattern: '2019',
      uploadDate: new Date(),
      downloadGate: {
        enabled: false,
        type: 'none',
        whatsappUrl: '',
        telegramUrl: ''
      }
    });
    
    await newFile.save();
    console.log(`Uploaded paper ${i+1}`);
  }
  
  console.log(`Successfully uploaded ${links.length} papers for Discrete Mathematics.`);
  await mongoose.disconnect();
}

run().catch(console.error);
