require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

const links = [
  "https://drive.google.com/file/d/15Dl-DUS1XNtDntZz2-d-r96XNVg5SpNM/view?usp=sharing",
  "https://drive.google.com/file/d/1Eq1H9P4c3-i_5LE2SKcBrXb4-fzQu8t2/view?usp=sharing",
  "https://drive.google.com/file/d/1QPP-gRi3_yuBik5N3kjda4wWjfhu8loG/view?usp=sharing",
  "https://drive.google.com/file/d/1kOxM9CUxVo--R6LpHnya43Zk4O9-Q8ey/view?usp=sharing",
  "https://drive.google.com/file/d/1q8cYrkctCGVZMzOsRlbpqobCOZAoQWkN/view?usp=sharing",
  "https://drive.google.com/file/d/1r7JRDQ-R6g4hrPD2o7JYZg6YNBwnhmU1/view?usp=sharing",
  "https://drive.google.com/file/d/1t-sZA18v1IWVjd80OS7B6R6_XLDbwJLb/view?usp=sharing",
  "https://drive.google.com/file/d/1yda-nnZgQctal9dbLDbchKLWzbeHc4Fw/view?usp=sharing"
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (let i = 0; i < links.length; i++) {
    const newFile = new File({
      originalName: `Fundamentals of Data Structures, 2019 pattern_${i+1}.pdf`,
      storedName: `google-drive_${Date.now()}_${i}`,
      year: 'second',
      branch: 'Computer Engineering',
      subject: 'Fundamentals of Data Structures, 2019 pattern',
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
  
  console.log(`Successfully uploaded ${links.length} papers for FDS.`);
  await mongoose.disconnect();
}

run().catch(console.error);
