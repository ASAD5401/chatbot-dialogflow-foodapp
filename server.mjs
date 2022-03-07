import express from "express";
import cors from "cors";
import dialogflow from '@google-cloud/dialogflow';
import gcHelper from "google-credentials-helper";
import mongoose from 'mongoose'
import { WebhookClient, Card, Suggestion, Image, Payload } from 'dialogflow-fulfillment';
import {
    stringToHash,
    varifyHash
} from "bcrypt-inzi"
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';


// gcHelper(true);
const sessionClient = new dialogflow.SessionsClient();

const app = express();
app.use(cors())
app.use(express.json())


const PORT = process.env.PORT || 7001;
const SECRET = process.env.SECRET || "12345"

//db setup
mongoose.connect('mongodb+srv://asadalikhan:asadalikhan@cluster0.bnq9o.mongodb.net/myFirstDatabase?retryWrites=true&w=majority').then(() => console.log("connection succesfull")).catch((error) => console.log(error))
const userOrder = mongoose.model('Orders', {
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    order: {
        type: [String],
        required: true
    }
})


//signup
const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, required: true },
    created: { type: Date, default: Date.now },

})

const User = mongoose.model('User', UserSchema);
app.post('/api/v1/signup', (req, res) => {

    if (!req.body.email || !req.body.password || !req.body.name || !req.body.phone) {
        console.log("required field missing");
        res.status(403).send("required field missing");
        return;
    }

    else {
        User.findOne({ email: req.body.email }, (err, user) => {

            if (user) {
                res.send("user already exist")
            }
            else {
                console.log(req.body)

                stringToHash(req.body.password).then(passwordHash => {
                    console.log("hash: ", passwordHash);

                    let newUser = new User({
                        name: req.body.name,
                        email: req.body.email,
                        password: passwordHash,
                        phone: req.body.phone,
                    })
                    newUser.save(() => {
                        console.log("data saved")
                        res.send('signup success')
                    })
                })
            }
        })
    }
})


//signin
app.post('/api/v1/login', (req, res) => {


    if (!req.body.email || !req.body.password) {
        console.log("required field missing");
        res.status(403).send("required field missing");
        return;
    }

    console.log(req.body)

    User.findOne({ email: req.body.email }, (err, user) => {

        if (err) {
            res.status(500).send("error in getting data")
        } else {
            if (user) {

                varifyHash(req.body.password, user.password).then(result => {
                    if (result) {

                        var token = jwt.sign({
                            name: user.name,
                            email: user.email,
                            _id: user._id,
                        }, SECRET);
                        console.log("token created: ", token);

                        res.cookie("token", token, {
                            httpOnly: true,
                        });

                        res.send({
                            name: user.name,
                            email: user.email,
                            phone: user.phone,
                            _id: user._id,
                        });
                    } else {
                        res.status(401).send("Authentication fail");
                    }
                }).catch(e => {
                    console.log("error: ", e)
                })

            } else {
                res.send("user not found");
            }
        }
    })
})


app.post("/talktochatbot", async (req, res) => {

    const projectId = "asad-tvve"
    const sessionId = req.body.sessionId || "session123"
    const query = req.body.text;
    const languageCode = "en-US"

    console.log("query: ", query, req.body);

    // The path to identify the agent that owns the created intent.
    const sessionPath = sessionClient.projectAgentSessionPath(
        projectId,
        sessionId
    );

    // The text query request.
    const request = {
        session: sessionPath,
        queryInput: {
            text: {
                text: query,
                languageCode: languageCode,
            },
        },
    };
    try {
        const responses = await sessionClient.detectIntent(request);
        // console.log("responses: ", responses);
        // console.log("resp: ", responses[0].queryResult.fulfillmentText);    
        res.send({
            text: responses[0].queryResult.fulfillmentText
        });

    } catch (e) {
        console.log("error while detecting intent: ", e)
    }
})
const order = []
const smallPrice = 500
const mediumPrice = 700
const largePrice = 900
const saladPrice = 400
const pastaPrice = 300


app.post("/webhook", (req, res) => {

    const agent = new WebhookClient({ request: req, response: res });

    function showMenu(agent) {
        console.log(`intent  =>  showmenu`);
        agent.add('In menu we have Pizzas , Salad & Pasta|https://pizzapiecafe.co/wp-content/uploads/2015/06/Hero_Pizzas_23-1024x683.jpg')
    }
    function pizzaFlavours(agent) {
        console.log(`intent  =>  pizzaFlavours`);
        agent.add('In pizza we have 8 different flavours|https://i0.wp.com/menuprices.pk/wp-content/uploads/2021/10/Pizza-Flavours-Name-in-Pakistan-With-Pictures-scaled.jpg?ssl=1')
    }
    function sizePizza(agent) {
        console.log(`intent  =>  sizePizza`);
        agent.add('We have three categories in every flavour|https://firebasestorage.googleapis.com/v0/b/asad-tvve.appspot.com/o/pizza.jpeg?alt=media&token=9f78e12e-9df4-4666-95c4-4bcae39979cd')
    }
    function placeOrder(agent) {
        console.log(`intent  =>  placeOrder`);

        const quantity = agent.parameters.quantity;
        const size = agent.parameters.size;
        const pizzaName = agent.parameters.pizzaName;
        order.push({
            quantity: quantity,
            size: size,
            pizzaName: pizzaName
        })

        // console.log(order)
        agent.add(`Noted ${quantity} ${size} ${pizzaName}. Would you like anything to add more `)
    }




    function showCart(agent) {
        console.log(`intent  =>  showCart`);
        // agent.add("asad")
        var totalBill = 0
        agent.add(`Your order is ${order.map((ord) => {
            if (ord.size == "small") {
                totalBill += smallPrice * ord.quantity
            }
            else if (ord.size == "medium") {
                totalBill += mediumPrice * ord.quantity
            }
            else if (ord.size == "large") {
                totalBill += largePrice * ord.quantity
            }
            return `${ord.quantity} ${ord.size} ${ord.pizzaName}`
        })} .Your total bill is of ${totalBill}Rs. Would you like to checkout or wanted to add up things `)
    }

    function checkout(agent) {
        console.log(`intent  =>  checkout`);
        var totalBill = 0
        order.map((ord) => {
            if (ord.size == "small") {
                totalBill += smallPrice * ord.quantity
            }
            else if (ord.size == "medium") {
                totalBill += mediumPrice * ord.quantity
            }
            else if (ord.size == "large") {
                totalBill += largePrice * ord.quantity
            }
        })

        agent.add('Your order has been placed. You can ask for status or check it in your browser')

    }




    //      function showBill(agent) {
    // const totalBill=0
    //         console.log(`intent  =>  showBill`);
    //         order.map((ord)=>{
    //             if(ord.size=="small"){
    //                 totalBill+=smallPrice*ord.quantity
    //             }
    //             else if(ord.size=="medium"){
    //                 totalBill+=mediumPrice*ord.quantity
    //             }
    //             else if(ord.size=="large"){
    //                 totalBill+=largePrice*ord.quantity
    //             }
    //         })
    //         agent.add('Your total')
    //     }

    // function checkout(agent) {
    //     console.log(`intent  =>  checkout`);
    //     agent.add('Your order for the ')
    // }

    function welcome(agent) {
        agent.add(new Card({
            title: 'Vibrating molecules',
            imageUrl: "https://media.nationalgeographic.org/assets/photos/000/263/26383.jpg",
            text: 'Did you know that temperature is really just a measure of how fast molecules are vibrating around?! 😱',
            buttonText: 'Temperature Wikipedia Page',
            buttonUrl: "https://sysborg.com"
        })
        );

        let image = new Image("https://media.nationalgeographic.org/assets/photos/000/263/26383.jpg");

        agent.add(image)

        // agent.add(` //ssml
        //     <speak>
        //         <prosody rate="slow" pitch="-2st">Can you hear me now?</prosody>
        //     </speak>
        // `);

        agent.add('Welcome to the Weather Assistant!');
        agent.add('you can ask me name, or weather updates');
        agent.add(new Suggestion('what is your name'));
        agent.add(new Suggestion('Weather update'));
        agent.add(new Suggestion('Cancel'));


        const facebookSuggestionChip = [{
            "content_type": "text",
            "title": "I am quick reply",
            // "image_url": "http://example.com/img/red.png",
            // "payload":"<DEVELOPER_DEFINED_PAYLOAD>"
        },
        {
            "content_type": "text",
            "title": "I am quick reply 2",
            // "image_url": "http://example.com/img/red.png",
            // "payload":"<DEVELOPER_DEFINED_PAYLOAD>"
        }]
        const payload = new Payload(
            'FACEBOOK',
            facebookSuggestionChip
        );
        agent.add(payload)

    }

    function weather(agent) {
        // Get parameters from Dialogflow to convert
        const cityName = agent.parameters.cityName;

        console.log(`User requested to city ${cityName}`);

        //TODO: Get weather from api
        // agent.add(new Payload("PLATFORM_UNSPECIFIED",{
        //     "textMessages":["here is full menu"]
        // },{rawPayload:true,sendAsMessage:true}
        // ))


        // text | image
        agent.add(`in ${cityName} its 27 degree centigrade asad, would you like to know anything else?|https://media.nationalgeographic.org/assets/photos/000/263/26383.jpg`);

    }

    function fallback(agent) {
        agent.add('Woah! Its getting a little hot in here.');
        agent.add(`I didn't get that, can you try again?`);
    }

    let intentMap = new Map(); // Map functions to Dialogflow intent names
    intentMap.set('Default Welcome Intent', welcome);
    intentMap.set('weather', weather);
    intentMap.set('Default Fallback Intent', fallback);
    intentMap.set('showMenu', showMenu);
    intentMap.set('pizzaFlavours', pizzaFlavours);
    intentMap.set('sizePizza', sizePizza);
    intentMap.set('placeOrder', placeOrder);
    intentMap.set('showCart', showCart);
    intentMap.set('checkout', checkout);






    agent.handleRequest(intentMap);

})









// app.post("/webhook", (req, res) => {

//     const params = req.body.queryResult.parameters;

//     console.log("params.cityName: ", params.cityName)

//     // TODO: make api call to weather server

//     res.send({
//         "fulfillmentText": `response from webhok. weather of ${params.cityName} is 17°C.
//                             thank you for calling weather app. good bye.`,

//         "fulfillmentMessages": [
//             {
//                 "text": {
//                     "text": [
//                         `response from webhoook weather of ${params.cityName} is 17°C.
//                         thank you for calling weather app. good bye.`
//                     ]
//                 }
//             }
//         ]
//     })
// })


app.get("/profile", (req, res) => {
    res.send("here is your profile");
})
app.get("/about", (req, res) => {
    res.send("some information about me");
})

app.listen(PORT, () => {
    console.log(`server is running on port ${PORT}`);
});