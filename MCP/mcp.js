
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import axios from "axios";
import { withPaymentInterceptor ,createSigner} from "x402-axios";


import express from 'express';
import cors from "cors";
import { z } from "zod";
import bs58 from "bs58";



const server = new McpServer({
    name: "x402 MCP Velocity Client",
    version: "1.0.0",
});



server.registerTool(

  "get-data-from-resource-server_by_get_method",

  {    
     title:"get data from x402 endpoints via get method",
     description:"this tool lets you request x402 enabled get endpoints and get data from them",
    
     inputSchema: {

      ownerwallet:z.string(),
      endpoint: z.string(),
      privateKey: z.string(),

    },
  
  },
  async ({ ownerwallet, endpoint,privateKey}) => {

    
    const secretKeyBytes = Buffer.from(privateKey, "hex");

    const privateKeyBase58 = bs58.encode(secretKeyBytes);
    const signer=await createSigner("solana",privateKeyBase58)

    const baseURL="https://xvelocity.dev"
    const client = withPaymentInterceptor(
      axios.create({
        baseURL,
         timeout: 30000
      }),
      
      signer,
      undefined,
     { svmConfig: { rpcUrl: "https://api.mainnet.solana.com" } }  // or mainnet
  );


    try{
    
        const res = await client.get(`${endpoint}`,
          {
              headers:{
                  "x-wallet":ownerwallet,
                  "Content-Type":"application/json"
              }
          }
      );
      const dataToUse = { ...res.data };
      console.log(dataToUse)
     return {
      
        content: [{ type: 'text', text: JSON.stringify(dataToUse) }],
        structuredContent: dataToUse
      };
    }catch(e){
      console.log(e)
    }
    

}
);





server.registerTool(

  "get-data-from-resource-server_by_post",

  {    
     title:"get data from x402 endpoints via post method",
     description:"this tool lets you request x402 enabled post endpoints and get data from them",
    
     inputSchema: {

      ownerwallet:z.string(),
      endpoint: z.string(),
      body: z.record(z.any()),
      privateKey: z.string(),
      tag:z.string().optional()
    },
  
  },
  async ({ ownerwallet, endpoint, privateKey,body,tag}) => {

    
    const secretKeyBytes = Buffer.from(privateKey, "hex");

    const privateKeyBase58 = bs58.encode(secretKeyBytes);
    const signer=await createSigner("solana",privateKeyBase58)

    const baseURL="https://xvelocity.dev"
    const client = withPaymentInterceptor(
      axios.create({
        baseURL,
         timeout: 30000
      }),
      
      signer,
      undefined,
     { svmConfig: { rpcUrl: "https://api.mainnet.solana.com" } }  // or mainnet
  );

     const res = await client.post(`${endpoint}`,body,
         {
            headers:{
                "x-wallet":ownerwallet,
                "x402id":tag,
                "Content-Type":"application/json"
            }
        }
        )
  
    const dataToUse = { ...res.data };
    console.log(dataToUse)
    return {
        content: [{ type: 'text', text: JSON.stringify(dataToUse) }],
        structuredContent:dataToUse
    };
    

  
  },
);





const app = express();
app.use(express.json());
app.use(cors());




app.post('/mcp', async (req, res) => {
  
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
});
await server.connect(transport);

    res.on('close', () => {
        transport.close();
    });

    

    await transport.handleRequest(req, res, req.body);
});

const port = parseInt(process.env.PORT || '3001');
app.listen(port, () => {
    console.log(`MCP Server running on http://localhost:${port}/mcp`);
}).on('error', error => {
    console.error('Server error:', error);
    process.exit(1);

});
