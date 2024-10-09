if (process.env.NODE_ENV !== "production") {
    require("dotenv").config();
}
const iceCandidateBuffer = new Map();
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
const https = require('https');
const express = require('express');
const app = express();
const socketio = require('socket.io');
app.use(express.static(__dirname));
const { v4: uuidV4 } = require('uuid');

let connectedClients = 0;

const expressServer = app.listen(process.env.PORT || 3000, () => {
    console.log(`Server running on port ${process.env.PORT || 3000}`);
});

// Create our socket.io server
const io = socketio(expressServer, {
    cors: {
        origin: [
            'https://10.0.0.66',
            "https://r3dxx-9ce6f110c87b.herokuapp.com" // If using a phone or another computer
        ],
        methods: ["GET", "POST"]
    }
});

// Offers will contain {}
let offers = [];
const connectedSockets = [];

io.on('connection', (socket) => {
    connectedClients++;
    const { userName, password } = socket.handshake.auth;

    // Authenticate the user
    if (password !== "x") {
        socket.disconnect(true);
        return;
    }

    connectedSockets.push({ socketId: socket.id, userName });

    socket.on('joinRoom', (room) => {
        socket.join(room);
        console.log(`${socket.id} joined room: ${room}`);

        const usersInRoom = io.sockets.adapter.rooms.get(room);
        const currentUserCount = usersInRoom ? usersInRoom.size : 0;

        if (currentUserCount === 2) {
            io.to(room).emit('bothUsersInRoom');
        } else {
            console.log('Not enough users in room to emit event.');
        }
    });

    socket.on('leaveRoom', (room) => {
        socket.leave(room);
        console.log(`${socket.id} left room: ${room}`);
    });

    socket.on('newOffer', ({ offer, room }) => {
        const offerObj = {
            offer,
            from: socket.id,
            offererUserName: userName,
            offerIceCandidates: [] // Initialize an array to store ICE candidates
        };

        // Store the offer
        offers.push(offerObj);
        socket.to(room).emit('offerReceived', offerObj);
    });

    socket.on('newAnswer', ({ answer, room }, ackFunction) => {
        const socketToAnswer = connectedSockets.find(s => s.userName === answer.offererUserName);
        const socketIdToAnswer = socketToAnswer ? socketToAnswer.socketId : null;
        const offerToUpdate = offers.find(o => o.offererUserName === answer.offererUserName);

        if (socketIdToAnswer && offerToUpdate) {
            offerToUpdate.answer = answer.answer;
            offerToUpdate.answererUserName = userName;
            socket.to(socketIdToAnswer).emit('answerResponse', offerToUpdate);
            processCandidateBuffer(offerToUpdate.offererUserName, socketIdToAnswer);
            processCandidateBuffer(userName, socket.id);
            ackFunction({ success: true });
        } else {
            console.error('Error processing answer. Socket ID or offer not found.');
            ackFunction({ error: 'Unable to process answer' });
        }
    });

    socket.on('sendIceCandidateToSignalingServer', iceCandidateObj => {
        const { didIOffer, iceUserName, iceCandidate } = iceCandidateObj;

        if (!iceUserName) {
            console.error('ICE User Name is undefined. Cannot buffer ICE candidate.');
            return; // Exit early if iceUserName is undefined
        }

        console.log('ICE Candidate received for user:', iceUserName);
        let offerInOffers = offers.find(o => 
            (didIOffer && o.offererUserName === iceUserName) || 
            (!didIOffer && o.answererUserName === iceUserName)
        );

        if (offerInOffers) {
            let targetUserName = didIOffer ? offerInOffers.answererUserName : offerInOffers.offererUserName;
            let socketToSendTo = connectedSockets.find(s => s.userName === targetUserName);

            if (socketToSendTo) {
                console.log('Sending ICE candidate to:', socketToSendTo.userName);
                socket.to(socketToSendTo.socketId).emit('receivedIceCandidateFromServer', iceCandidate);
            } else {
                bufferIceCandidate(targetUserName, iceCandidate);
            }
        } else {
            bufferIceCandidate(iceUserName, iceCandidate);
        }
    });

    socket.on('disconnect', () => {
        connectedClients--;
        console.log('User disconnected:', socket.id);
        socket.broadcast.emit('userDisconnected', { userId: socket.id });
        
        if (connectedClients === 0) {
            offers.length = 0; // Clear offers array
            io.emit('lastUserLeft');
            console.log('Last user left, notifying all clients.');
        }
    });

    // Emit available offers if any
    if (offers.length) {
        socket.emit('availableOffers', offers);
    }
});


function bufferIceCandidate(userName, iceCandidate) {
    if (!iceCandidateBuffer.has(userName)) {
        iceCandidateBuffer.set(userName, []);
    }
    iceCandidateBuffer.get(userName).push(iceCandidate);
    console.log('Buffering ICE candidate for:', userName);
}

// Process buffered ICE candidates for a user
function processCandidateBuffer(userName, socketId) {
    if (iceCandidateBuffer.has(userName)) {
        console.log('Processing buffered ICE candidates for:', userName);
        iceCandidateBuffer.get(userName).forEach(candidate => {
            socket.to(socketId).emit('receivedIceCandidateFromServer', candidate);
        });
        iceCandidateBuffer.delete(userName);
    }
}

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

            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
            req.session.verificationCode = verificationCode;

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
    if (req.isAuthenticated()) {
        res.sendFile(path.join(__dirname, 'views', 'index.html'));
    } else {
        res.redirect('/login');
    }
});

app.post('/redirect', (req, res) => {
    res.redirect('/register');
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
});

app.post('/redirect1', (req, res) => {
    res.redirect('/login');
});

// Room route
app.get('/:room.html', (req, res) => {
    res.render('index', { roomId: req.params.room });
});

// Registration route
app.get('/register', checkNotAuthenticated, (req, res) => {
    res.render("register.ejs");
});
