import {Configuration, OpenAIApi} from 'openai';
import {writeFileSync } from 'fs';
import * as dotenv from 'dotenv'; 
import fetch from 'node-fetch';
dotenv.config()

const configuration = new Configuration({
  apiKey: process.env.API_KEY
})

const openai = new OpenAIApi(configuration);

const prompt = "a nature documentary style photograph of a large open cavern that is part of a deep underground cave system in the moon"

const result = await openai.createImage({
  prompt,
  n:1,
  size:"1024x1024",
  user: "toddwords"
})

const url = result.data.data[0].url;
console.log(url)


const imgResult = await fetch(url);
const blob = await imgResult.blob();
const buffer = Buffer.from( await blob.arrayBuffer() )
writeFileSync(`./img/${Date.now()}.png`, buffer)

