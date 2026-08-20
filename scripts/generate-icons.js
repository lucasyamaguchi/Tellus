import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

async function generateIcons() {
  const sourceImage = path.resolve('Gemini_Generated_Image_3jbtbv3jbtbv3jbt.png');
  const resourcesDir = path.resolve('resources');
  const clientPublicDir = path.resolve('client', 'public');

  if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });
  if (!fs.existsSync(clientPublicDir)) fs.mkdirSync(clientPublicDir, { recursive: true });

  const squarePngPath = path.join(resourcesDir, 'icon-square.png');

  // Resize and center into 512x512 square PNG
  await sharp(sourceImage)
    .resize(512, 512, {
      fit: 'cover',
      position: 'center'
    })
    .png()
    .toFile(squarePngPath);

  // Copy standard PNGs
  fs.copyFileSync(squarePngPath, path.join(resourcesDir, 'icon.png'));
  fs.copyFileSync(squarePngPath, path.join(clientPublicDir, 'icon.png'));
  fs.copyFileSync(squarePngPath, path.join(clientPublicDir, 'logo.png'));

  // Generate multi-size ICO
  try {
    const icoBuffer = await pngToIco(squarePngPath);
    fs.writeFileSync(path.join(resourcesDir, 'icon.ico'), icoBuffer);
    fs.writeFileSync(path.join(clientPublicDir, 'favicon.ico'), icoBuffer);
    console.log('✅ Ícones .ico e .png perfeitos gerados com sucesso!');
  } catch (err) {
    console.error('Erro na conversão ICO:', err);
  }
}

generateIcons();
