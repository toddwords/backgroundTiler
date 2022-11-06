import {Configuration, OpenAIApi} from 'openai';
import {writeFileSync, createReadStream, createWriteStream } from 'fs';
import express from 'express'
import * as dotenv from 'dotenv';
import fetch from 'node-fetch';
import sharp from 'sharp';
dotenv.config()

const configuration = new Configuration({
  apiKey: process.env.API_KEY
})

const openai = new OpenAIApi(configuration);

const size = 1024

const saveImage = async (buffer: Buffer, slug: string) => {
  const filename = `./results/${slug}-${Date.now()}.png`
  writeFileSync(filename, buffer)
  return filename
}

const loadImage = async(filename:string) => {
  const buffer = await sharp(filename).toBuffer();
  return buffer;
}

const downloadImage = async (url: string) => {
  const imgResult = await fetch(url);
  const blob = await imgResult.blob();
  return Buffer.from( await blob.arrayBuffer() )
}

// const blankImageTemplate =


const generateMaskShape = async () => {
  // const svg = `<svg width="${size}" height="${size}" version="1.1" xmlns="http://www.w3.org/2000/svg"> +
  //     <defs>
  //         <linearGradient id="Gradient2" x1="0" x2="0" y1="0" y2="1">
  //           <stop offset="0%" stop-color="white" stop-opacity="100"/>
  //           <stop offset="100%" stop-color="white" stop-opacity="0"/>
  //         </linearGradient>
  //     </defs>
  //   <rect x="0" y="0" width="${size}" height="${size}" fill="url(#Gradient2)"/>
  // </svg>`;

  // const svg = `<svg width="${size}" height="${size}" version="1.1" xmlns="http://www.w3.org/2000/svg">
  //   <rect x="0" y="${size/20*9}" width="${size}" height="${size/20*2}" fill="white"/>
  //   <rect x="${size/20*9}" y="0" width="${size/20*2}" height="${size}" fill="white"/>
  // </svg>`;

  const svg = `<svg width="${size}" height="${size}" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
  </svg>`;

  return await sharp(Buffer.from(svg))
  .toBuffer()
}

console.log('Making mask shape...')
const maskShape = await generateMaskShape();

const generateImage = async ({
  prompt,
}:{
  prompt: string,
}) => {

  const result = await openai.createImage({
    prompt,
    n:1,
    size: `${size}x${size}`,
    user: "toddwords"
  })
  const url = result.data.data[0].url;
  // writeFileSync(`./results/${slug}-${Date.now()}.png`, buffer)

  return await downloadImage(url);
}

const getTempFileName = (slug:string) => {
  return `./temp/${Date.now()}${Math.random()}${slug}`;
}
const makeImageTileable = async (buffer: Buffer, prompt: string) => {

  const slug = 'mask-image.png'
  const tempFileName = getTempFileName(slug);

  await sharp(buffer)
  .composite([
    {input: buffer, left: -size/2, top: -size/2, blend: 'over'},
    {input: buffer, left: size/2, top: -size/2, blend: 'over'},
    {input: buffer, left: -size/2, top: size/2, blend: 'over'},
    {input: buffer, left: size/2, top: size/2, blend: 'over'},
    {input: maskShape, left: 0, top: 0, blend: 'dest-out'},
  ])
  .toFile(tempFileName);

  const result = await openai.createImageEdit(
    // @ts-expect-error
    createReadStream(tempFileName),
    createReadStream(tempFileName),
    prompt
  )

  return await downloadImage(result.data.data[0].url);
}

const createTileablePreviewPage = (fullImagePath:string) => {
  const filename = fullImagePath.split('/').pop();

  const html = `
    <html>
      <body style="background-image: url(${filename}); min-width: 1000vw; min-height: 1000vh;">
      </body>
    </html>
  `
  const stream = createWriteStream(`./results/${filename}.html`);

  stream.once('open', function() {
    stream.end(html);
  });
}

const createTileableImage = async ({prompt,slug}:{prompt:string,slug:string}) => {
  console.log('Generating image...')
  const image = await generateImage({
    prompt
  })

  console.log('Making tileable...')
  const tileableImage = await makeImageTileable(image,prompt);

  console.log('Saving image...')
  const imageFilename = await saveImage(tileableImage, slug)

  console.log('Make preview html...')
  createTileablePreviewPage(imageFilename);
}


// await createTileableImage({
//   prompt: 'A photorealistic public swimming pool water from above',
//   slug: 'water'
// })

const expandImage = async ({
  image,
  prompt,
  slug,
  numPanels
}:{
  image:Buffer,
  prompt:string,
  slug:string,
  numPanels:number
}) => {


  const images = [
    image
  ]

  for(let i = 0; i < numPanels; i++){
    const imageToSample = images[i]

    console.log(i,'Creating expansion template to feed into DallE...')
    const tempFileName = getTempFileName(`${slug}-expansion-${i}.png`)

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
    .png()
    .composite([
      {input: imageToSample, left: -size/2, top: 0, blend: 'over'},
    ])
    .toFile(tempFileName);

    console.log('Expanding image...')
    const result = await openai.createImageEdit(
      // @ts-expect-error
      createReadStream(tempFileName),
      createReadStream(tempFileName),
      prompt
    )
    const expandedImage = await downloadImage(result.data.data[0].url);
    saveImage(expandedImage, `${slug}-expansion-${i}`)
    images.push(expandedImage)
  }

  await sharp({
    create: {
      width: size  * (1+0.5*numPanels),
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
  .png()
  .composite(
    images.map((slice,i) => ({
      input: slice,
      left: i*size/2,
      top: 0,
      blend: 'over'
    }))
  )
  .toFile(getTempFileName(`${slug}-expanded-merged.png`));
}



const seedImage = await loadImage('./assets/moonsurface.png');
await expandImage({
  image: seedImage,
  prompt: 'A photorealistic top down image of the surface of the moon',
  slug: 'moon1',
  numPanels: 3,
});

