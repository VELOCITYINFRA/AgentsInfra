import bs58 from "bs58";
import { Keypair } from '@solana/web3.js';
import { TextEncoder } from 'util';
import nacl from "tweetnacl";
import { provideClient } from "./dbconnection.js";



const url ="https://itsvelocity/x401_auth_agent"
const path=new URL("https://itsvelocity/x401_auth_agent").pathname;
const appId="appid"
const appSecret="appsecret"
const basic = btoa(`${appId}:${appSecret}`);



const client=provideClient()
const db = client.db("mpc_db");
const coll = db.collection("mpc_col");



async function createWallet(){
    
        const res = await fetch("https://api.privy.io/v1/wallets", {
                    method: "POST",
                    headers: {
                        "Authorization": `Basic ${basic}`,
                        "Content-Type": "application/json",
                        "privy-app-id": "appid"
                    },
                    body: JSON.stringify({
                        chain_type: "solana"
                    })
                });

        const data = await res.json();
        console.log(data);
        return {
            address:data.address,
            id:data.id
        }

}


async function Corex401(wallet){


    console.log("Starting authentication...");
      
        const nonce = await getNonce();
        console.log("Got nonce:", nonce);
        if (!nonce) {
            console.error("Failed to get nonce!");
            return;
        }
        console.log("Building payload...");
        const payload = buildSigningPayload(nonce);
        const { signature, publicKey } = await signPayload(payload,wallet);
        console.log(signature)
        
        const res = await fetch(url, {
            mode:"cors",
            method:"get",
            cache:"no-store",
            headers: {

                "X-401-Nonce":nonce,
                "X-401-Signature":signature,
                "X-401-Addr": publicKey,
                "required_mint":config.required_mint,
                "mint_amount":config.mint_amount,
                 "mpc":"false"
                
            }
        });

        const data = await res.json();
       
        if(res.status==500 && data.status=="tokenerror"){
              return {
                success: false,
                error: "INSUFFICIENT_TOKENS",
                message: "You need 100000 tokens to access the platform",
                required: 100000
        }}

       else if (res.status==500 && data.status=="signerror"){

                return {
                success: false,
                error: "SIGNATURE_ERROR",
                message: "Signature not Verified",
        };

       }
        else if (res.status==500 && data.status=="autherror"){

                return {
                success: false,
                error: "AUTHENTICATION_ERROR",
                message: "Authentication Error",
        }}

       else if(res.status==200) {
              return {
                success: true,
                alreadyAuthenticated: false,
                token:data.token

    }}




}


async function Corex401MPC(wallet,config){


        console.log("Starting authentication...");
      
        const nonce = await getNonce();
        console.log("Got nonce:", nonce);
        if (!nonce) {
            console.error("Failed to get nonce!");
            return;
        }
        console.log("Building payload...");
        const payload = buildSigningPayload(nonce);
        const base64Message = Buffer.from(payload).toString('base64');

        const signaturedata=await SignMessage(wallet.id,base64Message)
        
        console.log(signaturedata)
        
        const res = await fetch(url, {
            mode:"cors",
            method:"get",
            cache:"no-store",
            headers: {

                "X-401-Nonce":nonce,
                "X-401-Signature":signaturedata.data.signature,
                "X-401-Addr":wallet.address ,
                "required_mint":config.required_mint,
                "mint_amount":config.mint_amount,
                 "mpc":"true"
                
            }
        });

        const data = await res.json();
       
        if(res.status==500 && data.status=="tokenerror"){
              return {
                success: false,
                error: "INSUFFICIENT_TOKENS",
                message: `You need ${mint_amount} tokens to access the platform`,
                required: 100000
        }}

       else if (res.status==500 && data.status=="signerror"){

                return {
                success: false,
                error: "SIGNATURE_ERROR",
                message: "Signature not Verified",
        };

       }
        else if (res.status==500 && data.status=="autherror"){

                return {
                success: false,
                error: "AUTHENTICATION_ERROR",
                message: "Authentication Error",
        }}

       else if(res.status==200) {
              return {
                success: true,
                alreadyAuthenticated: false,
                token:data.token

    }}




}





async function SignMessage(walletid,challange) {

    const res = await fetch(`https://api.privy.io/v1/wallets/${walletid}/rpc`, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${basic}`,
            "Content-Type": "application/json",
            "privy-app-id": appId
        },
        body: JSON.stringify({
            method: "signMessage",
            params: {
                message: challange,
                encoding: "base64"
            }
        })
        });

        const data = await res.json();
        console.log(data);
        return data



}




async function getNonce() {

        const res = await fetch(url,{
            mode:"cors",
            method:"get",
            cache:"no-cache",
            headers:{ "content-type":"application/json"}
        });
      
        const data = await res.json();
        const nonce = res.headers.get("X-401-Nonce") || "";
        const mechanism = res.headers.get("X-401-Mechanism");
        console.log("Nonce:", nonce, "Mechanism:", mechanism);
        console.log("Initial response:", data);
        return nonce;
}



function buildSigningPayload(nonce) {

        return `CHALLENGE::${nonce}::${path}::VELOCITY401`;

}




async function signPayload(payload,base58SecretKey){

    try {

        const secretKeyBytes = bs58.decode(base58SecretKey);

        const keypair = Keypair.fromSecretKey(secretKeyBytes);
        const messageBytes = new TextEncoder().encode(payload);
        const signatureBytes = nacl.sign.detached(messageBytes, keypair.secretKey);
        const signatureBase58 = bs58.encode(signatureBytes);
        return {
            publicKey: keypair.publicKey.toBase58(),
            signature: signatureBase58,
        };

    }catch(e){
        console.log(e)
        return null
    }

}


export async function VelocityAgentAuth(config) {

 
    if (config.mpc === true) {

  let mpcdata = await coll.findOne({ owner: "system" });

  if (!mpcdata || !mpcdata.mpc) {

    const walletdata = await createWallet();

    const payload = {
      agent: config.agent,
      id: walletdata.id,
      address: walletdata.address
    };

    await coll.updateOne(
      { owner: "system" },
      { $push: { mpc: payload } },
      { upsert: true }
    );

    return await Corex401MPC(payload, config);

  } else {

    const existingItem = mpcdata.mpc.find(
      item => item.agent === config.agent
    );

    if (!existingItem) {
      throw new Error("Agent not registered in MPC");
    }

    return await Corex401MPC(existingItem, config);
  }
}

   

    if(config.token) {

            const res = await fetch(url, {
            mode:"cors",
            method:"get",
            cache:"no-store",
            headers:{
                "content-type":"application/json",
                "x-jwt":config.token
            }
            });
        
            return {
                success: true,
                alreadyAuthenticated: true,
                token:res
            
            };  

    }  else {        
        let result=await Corex401(config.key)
        return result
       
    }


}

