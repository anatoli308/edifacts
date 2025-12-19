import mongoose from 'mongoose';

import validator from 'validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    theme: {
        fontColor: {
            type: String,
            default: "#2065D1"
        },
        backgroundMode: {
            type: String,
            default: "white"
        },
        fontSize: {
            type: Number,
            default: 3
        },
    },
    location: {
        type: String,
        trim: true,
        default: ""
    },
    role: {
        type: String,
        default: "USER"
    },
    email: {
        type: String,
        trim: true,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        validate: {
            validator: value => validator.isEmail(value),
            message: 'Invalid Email address'
        }
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    password: {
        type: String,
        required: true,
        minLength: 3
    },
    tokens: [{
        token: {
            type: String,
            required: true
        },
        device: {
            type: String,
            default: 'unknown'
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    banned: {
        type: Date
    },
    tosAccepted: {
        type: Boolean,
        default: false
    },
}, {
    timestamps: true // Automatisch createdAt und updatedAt
})

// Indexes für bessere Performance
userSchema.index({ email: 1 });
userSchema.index({ name: 1 });

// Password nicht in JSON responses zurückgeben
userSchema.methods.toJSON = function () {
    const user = this.toObject();
    delete user.password;
    delete user.tokens;
    return user;
};

userSchema.pre('save', async function (next) {
    // Hash the password before saving the user model
    const user = this
    if (user.isModified('password')) {
        user.password = await bcrypt.hash(user.password, 8)
    }
    next()
})

userSchema.methods.generateAuthToken = async function (device = 'web') {
    const user = this;

    if (!process.env.JWT_KEY) {
        throw new Error('JWT_KEY is not defined in environment variables');
    }

    const token = jwt.sign(
        { _id: user._id, email: user.email },
        process.env.JWT_KEY,
        { expiresIn: '7d' }
    );

    // Optional: Limit tokens per user (z.B. max 5 Geräte)
    if (user.tokens.length >= 5) {
        user.tokens.shift(); // Entferne ältestes Token
    }

    user.tokens.push({ token, device });
    await user.save();
    return token;
};

// Static method für Login
userSchema.statics.findByCredentials = async function (email, password) {
    const user = await this.findOne({ email });

    if (!user) {
        throw new Error('Unable to login - Invalid credentials');
    }

    if (user.banned) {
        throw new Error('Account is banned');
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
        throw new Error('Unable to login - Invalid credentials');
    }

    return user;
};

export default mongoose.models.User || mongoose.model('User', userSchema)