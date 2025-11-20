/**
 * Risteyskuvien tarkistustyökalu
 * 
 * Tämä skripti vertaa CSV-tiedostossa olevia risteyksen ID:itä
 * public/intersections/ -kansiossa oleviin kuviin ja raportoi:
 * - Mitkä risteyksistä löytyy kuva
 * - Mitkä risteyksistä puuttuu kuva
 * - Mitkä kuvat ovat ylimääräisiä (ei vastaavaa ID:tä CSV:ssä)
 * 
 * Käyttö: node scripts/check-images.js
 */

const fs = require('fs');
const path = require('path');

// Lue CSV-tiedosto
const csvPath = path.join(__dirname, '../public/intersections.csv');
const csvContent = fs.readFileSync(csvPath, 'utf-8');

// Lue kuvakansion sisältö
const imagesDir = path.join(__dirname, '../public/intersections');
const imageFiles = fs.readdirSync(imagesDir);

// Poista .png-päätteet kuvien nimistä
const imageNames = imageFiles.map(file => file.replace('.png', ''));

// Parsoi CSV ja hae kaikki risteysten ID:t
const lines = csvContent.split('\n').slice(1); // Ohita otsikkorivi
const intersectionIds = [];

lines.forEach(line => {
  if (line.trim()) {
    const [id] = line.split(';');
    if (id && id.trim()) {
      intersectionIds.push(id.trim());
    }
  }
});

// Poista duplikaatit
const uniqueIds = [...new Set(intersectionIds)];

// Vertaa ja luo taulukko
console.log('\n=== RISTEYSTEN JA KUVIEN VERTAILU ===\n');
console.log('Risteys ID'.padEnd(20) + ' | Kuva löytyy? | Kuvan nimi');
console.log('-'.repeat(70));

const missing = [];
const found = [];

uniqueIds.forEach(id => {
  // Etsi vastaava kuva (case-insensitive vertailu)
  const matchingImage = imageNames.find(img => 
    img.toLowerCase() === id.toLowerCase()
  );
  
  if (matchingImage) {
    found.push({ id, image: matchingImage + '.png' });
    console.log(id.padEnd(20) + ' | ✓           | ' + matchingImage + '.png');
  } else {
    missing.push(id);
    console.log('\x1b[31m' + id.padEnd(20) + ' | ✗ PUUTTUU   | -' + '\x1b[0m');
  }
});

// Tulosta yhteenveto
console.log('\n=== YHTEENVETO ===');
console.log(`Yhteensä risteysten ID:itä: ${uniqueIds.length}`);
console.log(`Kuvia löytyy: ${found.length}`);
console.log(`\x1b[31mKuvia puuttuu: ${missing.length}\x1b[0m`);

if (missing.length > 0) {
  console.log('\n=== PUUTTUVAT KUVAT ===');
  missing.forEach(id => console.log(`\x1b[31m- ${id}\x1b[0m`));
}

// Tarkista myös, onko kansiossa kuvia joille ei ole ID:tä CSV:ssä
console.log('\n=== YLIMÄÄRÄISET KUVAT (ei ID:tä CSV:ssä) ===');
const extraImages = imageNames.filter(img => 
  !uniqueIds.some(id => id.toLowerCase() === img.toLowerCase())
);

if (extraImages.length > 0) {
  extraImages.forEach(img => console.log(`- ${img}.png`));
} else {
  console.log('Ei ylimääräisiä kuvia.');
}
