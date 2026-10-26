require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

const links = [
  "https://drive.google.com/file/d/1-IaUGX6OcGIalfCEif2qML8xfK7nQIJJ/view?usp=sharing",
  "https://drive.google.com/file/d/1BjzNqMgcbkpmHFFU6XCV_Wciyd2I-tvt/view?usp=sharing",
  "https://drive.google.com/file/d/1EQ7kQ7ENtDaim2dAtAGQqHERnk0vZZxl/view?usp=sharing",
  "https://drive.google.com/file/d/1IPejDZKWA0ZiI7oCjI1NFJ4MC8bM9gqL/view?usp=sharing",
  "https://drive.google.com/file/d/1QKvfjNXEnuvbwiZ-c3i5Y2AZnawXI4t2/view?usp=sharing",
  "https://drive.google.com/file/d/1YeQZB56r9J1NMSiCttmCFPNJzY4VVvIY/view?usp=sharing",
  "https://drive.google.com/file/d/1ZSkWUBLn2LM1YKXBIfGTGHCivx8rNJE9/view?usp=sharing",
  "https://drive.google.com/file/d/1f7r9FzjvDpcDDAzAGbHAjjoQfwGMP4F8/view?usp=sharing",
  "https://drive.google.com/file/d/1yu7MZ0nWL2mxaIVErtyYjV7wCrwiR0kW/view?usp=sharing"
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (let i = 0; i < links.length; i++) {
    const newFile = new File({
      originalName: `Digital Electronics and Logic Design (2019 pattern)_${i+1}.pdf`,
      storedName: `google-drive_${Date.now()}_${i}`,
      year: 'second',
      branch: 'Computer Engineering',
      subject: 'Digital Electronics and Logic Design (2019 pattern)',
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
  
  console.log(`Successfully uploaded ${links.length} papers for DELD.`);
  await mongoose.disconnect();
}

run().catch(console.error);
