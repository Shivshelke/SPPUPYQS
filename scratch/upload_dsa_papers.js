require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const File = require('../models/File');

const links = [
  "https://drive.google.com/file/d/1GGyvkW7arkD95FQt1D3FEN_j_n1E82eq/view?usp=sharing",
  "https://drive.google.com/file/d/1N_xAqexNUveFAX6oqLbr_7-3GWMNtCgs/view?usp=sharing",
  "https://drive.google.com/file/d/1W3Uy2X1MLBCYkA9s1jVm-8niQxUfh0IR/view?usp=sharing",
  "https://drive.google.com/file/d/1WctEe8f1kz74JGo1GLrwiWzRHNUNvSkV/view?usp=sharing",
  "https://drive.google.com/file/d/1Z2o_OPuXfcfMaIsM3L6ivN_WZeQ3zFdI/view?usp=sharing",
  "https://drive.google.com/file/d/1_SValObXgymIxyxd4dSucG-O7OzTmp-U/view?usp=sharing",
  "https://drive.google.com/file/d/1dXzz2Wn1ky7e7Bh2bhhs-H8TvQiEcxps/view?usp=sharing",
  "https://drive.google.com/file/d/1q8b1EoKKs-d4sQ25u6kgeH1SMWxdghVr/view?usp=sharing",
  "https://drive.google.com/file/d/1u_8ewjVerWyMsgoVa4WHlkfIKq613x2l/view?usp=sharing"
];

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  for (let i = 0; i < links.length; i++) {
    const newFile = new File({
      originalName: `Data Structures and Algorithms, 2019 pattern_${i+1}.pdf`,
      storedName: `google-drive_${Date.now()}_${i}`,
      year: 'second',
      branch: 'Computer Engineering',
      subject: 'Data Structures and Algorithms, 2019 pattern',
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
  
  console.log(`Successfully uploaded ${links.length} papers for DSA.`);
  await mongoose.disconnect();
}

run().catch(console.error);
