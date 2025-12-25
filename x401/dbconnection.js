import { MongoClient, ServerApiVersion } from 'mongodb';


const uri = "mongodbappName=Cluster0"; 


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1, 
        strict: true,
        deprecationErrors: true,
    }
    });


async function runConnectionTest() {
  try {
  
    await client.connect();

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error("Connection error:", error);
   
  } 

}

runConnectionTest();



function provideClient() {
    return client;
}


export {provideClient}
