if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}
const PendingUser = require('./models/PendingUser'); // Adjust the path as necessary
const path = require("path");
const bcrypt = require("bcrypt");
const passport = require("passport");
const LocalStrategy = require('passport-local').Strategy;
const flash = require("express-flash");
const session = require("express-session");
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const User = require('./models/User');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https')
const express = require('express');
const app = express();
const socketio = require('socket.io');
app.use(express.static(__dirname))
const { v4: uuidV4 } = require('uuid');
//we need a key and cert to run https
//we generated them with mkcert
// $ mkcert create-ca
// $ mkcert create-cert

let connectedClients = 0;
//we changed our express setup so we can use https
//pass the key and cert to createServer on https
const expressServer = app.listen(process.env.PORT || 3000, () => {
   
});
//create our socket.io server... it will listen to our express port
const io = socketio(expressServer,{
    cors: {
        origin: [
             'https://10.0.0.66',
            "https://r3dxx-9ce6f110c87b.herokuapp.com" // if using a phone or another computer
        ],
        methods: ["GET", "POST"]
    }
});

//offers will contain {}
let offers = [
    // offererUserName
    // offer
    // offerIceCandidates
    // answererUserName
    // answer
    // answererIceCandidates
];
const connectedSockets = [
    //username, socketId
]

io.on('connection', (socket) => {
    connectedClients++;
    
    const userName = socket.handshake.auth.userName;
    const password = socket.handshake.auth.password;

    if (password !== "x") {
        socket.disconnect(true);
        return;
    }

    connectedSockets.push({ socketId: socket.id, userName });

    // Handle room joining
    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`${socket.id} joined room: ${room}`);

        const usersInRoom = io.sockets.adapter.rooms[room]?.sockets;
        if (usersInRoom && Object.keys(usersInRoom).length === 2) {
            console.log('emitting111');
            io.to(room).emit('bothUsersInRoom'); // Notify both users
        }
    });

    // Handle room leaving
    socket.on('leaveRoom', (room) => {
        socket.leave(room);
        console.log(`${socket.id} left room: ${room}`);
    });

    // Handle new offers and answers
    socket.on('newOffer', ({ offer, room }) => {
        socket.to(room).emit('offerReceived', { offer, from: socket.id });
    });

    socket.on('newAnswer', ({ answer, room }, ackFunction) => {
        const socketToAnswer = connectedSockets.find(s => s.userName === answer.offererUserName);
        if (!socketToAnswer) {
            console.log("No matching socket for answer");
            return;
        }

        const socketIdToAnswer = socketToAnswer.socketId;
        const offerToUpdate = offers.find(o => o.offererUserName === answer.offererUserName);
        if (!offerToUpdate) {
            console.log("No OfferToUpdate");
            return;
        }

        ackFunction(offerToUpdate.offerIceCandidates);
        offerToUpdate.answer = answer.answer;
        offerToUpdate.answererUserName = userName;
        socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate);
    });

    // Handle chat messages
    socket.on('serverMessage', message => {
        socket.broadcast.emit('chatmessage', message);
    });

    socket.on('sendMessage', (data) => {
        console.log('Message received from client:', data.text);
        socket.broadcast.emit('newMessage', { text: data.text });
    });

    socket.on('hangUp', () => {
        console.log('User hung up: ' + socket.id);
        socket.broadcast.emit('hangUp');
        io.emit('lastUserLeft');
    });

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;

        if (didIOffer) {
            const offerInOffers = offers.find(o => o.offererUserName === iceUserName);
            if (offerInOffers) {
                offerInOffers.offerIceCandidates.push(iceCandidate);
                if (offerInOffers.answererUserName) {
                    const socketToSendTo = connectedSockets.find(s => s.userName === offerInOffers.answererUserName);
                    if (socketToSendTo) {
                        socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
                    } else {
                        console.log("Ice candidate received but could not find answerer");
                    }
                }
            }
        } else {
            const offerInOffers = offers.find(o => o.answererUserName === iceUserName);
            const socketToSendTo = connectedSockets.find(s => s.userName === offerInOffers.offererUserName);
            if (socketToSendTo) {
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
            } else {
                console.log("Ice candidate received but could not find offerer");
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        connectedClients--;
        console.log('User disconnected');
        socket.broadcast.emit('userDisconnected', { userId: socket.id });
        if (connectedClients === 0) {
            offers = [];
            io.emit('lastUserLeft');
            console.log('Last user left, notifying all clients.');
        }
    });

    // Emit available offers if any
    if (offers.length) {
        socket.emit('availableOffers', offers);
    }
});



app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(require('cookie-parser')());
app.set('view engine', 'ejs');

// Nodemailer transporter setup
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: 'pantsbro4@gmail.com', // Replace with your email
        pass: 'tpxy ymac aupu ktow'   // Replace with your password
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Initialize Passport
function initialize(passport) {
    const authenticateUser = async (email, password, done) => {
        try {
            const user = await User.findOne({ email });
            if (!user) {
                return done(null, false, { message: 'No user with that email' });
            }
            if (await bcrypt.compare(password, user.password)) {
                return done(null, user);
            } else {
                return done(null, false, { message: 'Password incorrect' });
            }
        } catch (e) {
            return done(e);
        }
    };

    passport.use(new LocalStrategy({ usernameField: 'email' }, authenticateUser));
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });
    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
}

initialize(passport);

// MongoDB connection
mongoose.connect('mongodb+srv://kingcod163:Saggytits101@cluster0.rcyom.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
    serverSelectionTimeoutMS: 30000
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

app.use(flash());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session());

// Authentication middleware
function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/home');
    }
    next();
}

// Register route
app.post("/register", [
    body('username').notEmpty().withMessage('Username is required'),
    body('email').isEmail().withMessage('Enter a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const token = jwt.sign({ email: req.body.email }, process.env.JWT_SECRET, { expiresIn: '1h' });

        const pendingUser = new PendingUser({
            username: req.body.username,
            email: req.body.email,
            password: hashedPassword,
            token
        });

        await pendingUser.save();

        const url = `${process.env.HEROKU_APP_URL}/confirmation/${token}`;

        await transporter.sendMail({
            to: pendingUser.email,
            subject: 'Confirm Email',
            html: `Click <a href="${url}">here</a> to confirm your email.`,
        });

        res.status(201).send('User registered. Please check your email to confirm.');
    } catch (e) {
        console.log(e);
        res.status(500).send('Server error');
    }
});

// Email confirmation
app.get('/confirmation/:token', async (req, res) => {
    try {
        const token = req.params.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const pendingUser = await PendingUser.findOne({ email: decoded.email, token });

        if (!pendingUser) {
            return res.status(400).send('Invalid token or user does not exist');
        }

        const newUser = new User({
            name: pendingUser.username,
            email: pendingUser.email,
            password: pendingUser.password,
            isConfirmed: true
        });

        await newUser.save();
        await PendingUser.deleteOne({ email: pendingUser.email });

        res.send('Email confirmed. You can now log in.');
    } catch (e) {
        console.log(e);
        res.status(500).send('Server error');
    }
});

// Login route
app.get('/login', checkNotAuthenticated, (req, res) => {
    console.log("not auth")
    res.render("login.ejs");
});

// Handle login with verification
app.post("/login", async (req, res, next) => {
    passport.authenticate('local', async (err, user, info) => {
        if (err) {
            return next(err);
        }
        if (!user) {
            return res.redirect('/login');
        }
        req.logIn(user, async (err) => {
            if (err) {
                return next(err);
            }

            // Generate a random verification code
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Store verification code in session
            req.session.verificationCode = verificationCode;

            // Send the verification code via email
            await transporter.sendMail({
                to: user.email,
                subject: 'Your Verification Code',
               html: `<p>Your verification code is: <strong>${verificationCode}</strong></p>`,
                
            });

            return res.redirect('/verify');
        });
    })(req, res, next);
});

// Verification route
app.get('/verify', (req, res) => {
    res.render('verify.ejs');
});

// Handle verification code submission
app.post('/verify', (req, res) => {
    const { code } = req.body;

    if (code === req.session.verificationCode) {
        const roomId = uuidV4(); 
        return res.redirect('/index.html');
    } else {
        res.send('Invalid verification code. Please try again.');
    }
});
app.get('/index.html', checkAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
// Redirect root to a new room
app.get('/', (req, res) => {
    const roomId = uuidV4();
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    } else {
        res.redirect('/login');
    }
});
app.post('/redirect', (req,res) => {
res.redirect('/register')

});
// User search route
app.get('/search', async (req, res) => {
    const { name } = req.query;
    try {
        const users = await User.find({ name: new RegExp(name, 'i') }); // Case-insensitive search
        res.json(users);
    } catch (error) {
        res.status(500).send('Error searching users');
    }
})
app.post('/redirect1', (req,res) => {
    res.redirect('/login')
    
});
// Room route
app.get('/:index.html:', (req, res) => {
    res.render('index', { roomId: req.params.room });
});

// Registration route
app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render("register.ejs");
});
