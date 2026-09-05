require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

const links = [
  "https://drive.google.com/file/d/185Lxz9whVBUVwvJSrOVF7LYqL7YIf9JM/view?usp=sharing",
  "https://drive.google.com/file/d/1DqucsKHZUOar8nDg6TApHFNbZLL0dohc/view?usp=sharing",
  "https://drive.google.com/file/d/1H0ALvI_LsJlIw-_DXxz3UsbYIM3HQzuk/view?usp=sharing",
  "https://drive.google.com/file/d/1JbJaYRHhYgtK6S35sUapjM7s12Y8LGX-/view?usp=sharing",
  "https://drive.google.com/file/d/1QRNWSHmAkFK6woGKPoZDR22mMKnBKEgu/view?usp=sharing",
  "https://drive.google.com/file/d/1UbY1jQDJwzlV_32vR2QMXYj3icyC8pvS/view?usp=sharing",
  "https://drive.google.com/file/d/1Xy39I6xcIrnsi6mzpJ0P_Vu1dRE83mqO/view?usp=sharing",
  "https://drive.google.com/file/d/1odnGEhAPd1jypfaj7NGwhsmfed0ZCxhj/view?usp=sharing"
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (let i = 0; i < links.length; i++) {
    const newFile = new File({
      originalName: `Computer Graphics (2019 Pattern)_${i+1}.pdf`,
      storedName: `google-drive_${Date.now()}_${i}`,
      year: 'second',
      branch: 'Computer Engineering',
      subject: 'Computer Graphics (2019 Pattern)',
      semester: 'any',
      size: 0,
      uploadedBy: 'Synapse07',
      url: links[i],
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
  
  console.log(`Successfully uploaded ${links.length} papers for Computer Graphics (2019 Pattern).`);
  await mongoose.disconnect();
}

run().catch(console.error);
