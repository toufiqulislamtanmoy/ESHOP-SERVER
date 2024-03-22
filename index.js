const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_TOKEN);
const port = process.env.PORT || 5000

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Product Is Delivering")
})


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized ub access" });
    }
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(402).send({ error: true, message: "Token Problem access" });
        }
        req.decoded = decoded;
        next();
    })
}






const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.pwkxdfc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        const userCollections = client.db("e_comm").collection("users");
        const productsCollections = client.db("e_comm").collection("products");
        const borrowCollections = client.db("e_comm").collection("borrow");
        const cartCollections = client.db("e_comm").collection("cartItem");
        const paymentsCollections = client.db("e_comm").collection("paymentInfo");

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


        /********Create user ✅*******/
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

        /********Find The user Role ✅*******/

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


        /********Add Product POST API ✅*******/
        app.post("/add-product", async (req, res) => {
            const productDetails = req.body;
            console.log(productDetails);
            const result = await productsCollections.insertOne(productDetails);
            res.send(result);

        })

        /******** Single Product GET API ✅*******/
        app.get("/product-details/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productsCollections.findOne(query);
            res.send(result);

        })


        /******** Products GET API ✅*******/
        app.get("/products", async (req, res) => {
            const result = await productsCollections.find().toArray();
            res.send(result);

        })


        /********Add To Cart POST API ✅*******/
        app.post("/addtocart", verifyJWT, async (req, res) => {
            const userInfo = req.body;
            const result = await cartCollections.insertOne(userInfo);
            res.send(result);
        })

        /********Add To Cart Item GET API By Email ✅*******/
        app.get("/mycartItem/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { userEmail: email }
            const result = await cartCollections.find(query).toArray();
            res.send(result);
        })

        /********Delete A Cart Item DELETE API By Email ✅*******/
        app.delete("/deleteItem/:id", verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollections.deleteOne(query);
            res.send(result);
        })


        /********Update book PATCH API 🚗*******/
        app.patch("/updateBookDetails/:id", verifyJWT, verifyAdmin, async (req, res) => {
            try {
                const requestId = req.params.id;
                const prevDetails = await bookCollections.findOne({ _id: new ObjectId(requestId) });

                if (!prevDetails) {
                    return res.status(404).json({ error: "Book not found" });
                }

                const bookDetails = req.body;
                const {
                    authorName,
                    bookName,
                    category,
                    price,
                    downloadURL,
                    copiesAvailable,
                } = bookDetails;

                // Update the book details
                const updatedDetails = {
                    authorName: authorName || prevDetails.authorName,
                    bookName: bookName || prevDetails.bookName,
                    category: category || prevDetails.category,
                    price: price || prevDetails.price,
                    downloadURL: downloadURL || prevDetails.downloadURL,
                    copiesAvailable: copiesAvailable || prevDetails.copiesAvailable,
                    bookCoverImage: prevDetails.bookCoverImage, // Keep the existing cover image
                    preview: prevDetails.preview, // Keep the existing preview images
                };

                // Update the book details in MongoDB
                const result = await bookCollections.updateOne(
                    { _id: new ObjectId(requestId) },
                    { $set: updatedDetails }
                );

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: "Internal server error" });
            }
        });










        /********Single Cart Item GET API By ID*******/
        app.get("/singleCartItem/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollections.findOne(query);
            res.send(result);
        })




        // payment getway api
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = Math.round(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })


        // payment info data post api

        app.post('/payments', verifyJWT, async (req, res) => {
            const paymentInfo = req.body;
            const insertResult = await paymentsCollections.insertOne(paymentInfo);

            const deleteResult = await cartCollections.deleteOne(
                { _id: new ObjectId(paymentInfo.cartId) }
            );

            res.send({ insertResult, deleteResult });
        })

        // Payment Details GET API
        app.get("/paymentHistory/:email", verifyJWT, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await paymentsCollections.find(query).toArray();
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