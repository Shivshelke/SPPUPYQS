require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

const links = [
  "https://drive.google.com/file/d/1-6xpSCBonz5mXsHesqH039n84QVVYnQS/view?usp=sharing",
  "https://drive.google.com/file/d/1C0I4v0sP0xz6isOYBuW2ZwYQwcSM-fbY/view?usp=sharing",
  "https://drive.google.com/file/d/1I_O65tiBED6D0irro67ImQb3dJO7aMAz/view?usp=sharing",
  "https://drive.google.com/file/d/1SNK8hf-eV6wNW7viZwJ25NM2USuT0O7y/view?usp=sharing",
  "https://drive.google.com/file/d/1YU9jn6naGkoP1kw0nEniHB_m2STw8KPf/view?usp=sharing",
  "https://drive.google.com/file/d/1YfTvZayBsfU-ikJJuSaY4Oec_LvNS0cs/view?usp=sharing",
  "https://drive.google.com/file/d/1Z0zRasUMKCOqzy4m5X7QjTwipTcDFJoP/view?usp=sharing",
  "https://drive.google.com/file/d/1_brOJYobJ0dKOcw08v4uIglviGvP8xTt/view?usp=sharing",
  "https://drive.google.com/file/d/1nTdGDIRtH1q3w-3Y3i8LR3r3aGaXUoNq/view?usp=sharing"
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (let i = 0; i < links.length; i++) {
    const newFile = new File({
      originalName: `Object Oriented Programming (OOP), 2019 pattern_${i+1}.pdf`,
      storedName: `google-drive_${Date.now()}_${i}`,
      year: 'second',
      branch: 'Computer Engineering',
      subject: 'Object Oriented Programming (OOP), 2019 pattern',
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
  
  console.log(`Successfully uploaded ${links.length} papers for OOP.`);
  await mongoose.disconnect();
}

run().catch(console.error);
