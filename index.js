const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');

const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Book Is Downloading")
})


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized access" });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
    })
}




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.zvd8xno.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        client.connect();
        const userCollections = client.db("e-shopy").collection("users");
        const bookCollections = client.db("e-shopy").collection("books");

        /********JWT api call*******/
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" });
            res.send({ token });
        })


        // Verify admin
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const result = await userCollections.findOne(query);
            if (result?.role !== 'admin') {
                return res.status(403).send({ error: true, message: "forbidden access" });
            }
            next();
        }


        /********Create user*******/
        app.post("/users", async (req, res) => {
            const userDetails = req.body;
            const query = { email: userDetails.email };
            const existingUser = await userCollections.findOne(query);
            if (existingUser) {
                return res.send({ message: "User Already Exist" });
            }
            const result = await userCollections.insertOne(userDetails);
            res.send(result);
        })

        /********Find The user Role*******/

        app.get('/role/:email', async (req, res) => {
            const email = req.params.email;
            // console.log(email);
            const query = { email: email }
            const options = {
                projection: { role: 1 },
            };
            const result = await userCollections.findOne(query, options);
            res.send(result);

        })


         /********Add book POST API*******/
         app.post("/addbook",verifyJWT,verifyAdmin, async (req, res) => {
            const bookDetails = req.body;
            console.log(bookDetails);
            const result = await bookCollections.insertOne(bookDetails);
            res.send(result);
            
        })
         /******** Booka GET API*******/
         app.get("/allBooks", async (req, res) => {
            const result = await bookCollections.find().toArray();
            res.send(result);
            
        })


        // Send a ping to confirm a successful connection
        client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})