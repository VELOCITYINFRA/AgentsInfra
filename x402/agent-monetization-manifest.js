
import { provideClient } from "@/app/utils/mongodb";
import toUsdcUnits from "../../utils/usdcconverter";
import { NextRequest, NextResponse } from 'next/server';
import { X402PaymentHandler } from 'x402-solana/server';


const mc = provideClient();
const db = mc.db("x402ify_db");
const coll = db.collection("x402ify_col");



const CORS_HEADERS={
  
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': '*', 
    'Access-Control-Allow-Credentials': 'false', 
};


export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS
  });
}


export async function GET(req) {

       
    const wallet=req.headers.get("x-wallet") 

    const x402id=req.headers.get("x402id")
    const method = req.headers.get("x-method") || "GET";  // Get method from header

    
    const document=await coll.findOne({ "owner": wallet });




    let found_endpoint=null
    let found_price=null

    if (x402id.includes("x402")) {  
    
        const endpoints = document.endpoints;
    
        const found = endpoints.find(endpoint => 
            endpoint.endpoint_linker ===x402id
        );

        if (found) {
            found_endpoint = found.endpoint;
            found_price = found.price;
        }

    } else {
    
        const dynamicendpoints = document.dynamicendpoints;
    
        const found = dynamicendpoints.find(dendpoint => 
            dendpoint.endpoint_linker ===x402id
        );

        if (found) {
            found_endpoint = found.endpoint;
            found_price = found.price;
        }
    }

    const maxAmountRequired=toUsdcUnits(found_price)
    const to_wallet=wallet
   
   
     const x402 = new X402PaymentHandler({
         network: 'solana',
         treasuryAddress: to_wallet,
         facilitatorUrl: 'https://facilitator.payai.network',
     });
    
    

    const proxy_url = method === "POST" 
        ? `/api/postv`
        : `/api/${x402id}`;

    const paymentRequirements = await x402.createPaymentRequirements({
        price: {
            amount: maxAmountRequired,
            asset: {
                address:"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            }
        },
        network: 'solana',
        config: {
            description: 'velocity registered endpoint request',
            resource: proxy_url
        }
    });




  

    const response = x402.create402Response(paymentRequirements);

   

    let AMP_MANIFEST_DATA ={

        version:"v1",
        description:"Machine-readable manifest for X402 payment discovery.",
        endpoints: [
            {

                endpoint:proxy_url,
                method: method,
                paymentRequirements: response.body
            }
        ]
        }
          
    
    return NextResponse.json(
    
            AMP_MANIFEST_DATA, 
            { 
                status: 200,
                headers:CORS_HEADERS
            });
    }
