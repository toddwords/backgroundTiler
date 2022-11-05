import {Configuration, OpenAIApi} from 'openai';
import {writeFileSync, createReadStream } from 'fs';
import * as dotenv from 'dotenv'; 
import fetch from 'node-fetch';
dotenv.config()

const configuration = new Configuration({
  apiKey: process.env.API_KEY
})

const openai = new OpenAIApi(configuration);

const src = './img/leftMask.png'
const mask = './img/leftMask.png'

const result = await openai.createImageEdit(
  createReadStream(src),
  createReadStream(mask),
  "photo of the surface of the moon"
)

const url = result.data.data[0].url;
console.log(url)


const imgResult = await fetch(url);
const blob = await imgResult.blob();
const buffer = Buffer.from( await blob.arrayBuffer() )
writeFileSync(`./img/${Date.now()}.png`, buffer)

