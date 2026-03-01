// src/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDYJut4E3RA1eYw2DOzqFbuIAPNIPMwFiY",
    authDomain: "pet-town-rpg.firebaseapp.com",
    projectId: "pet-town-rpg",
    storageBucket: "pet-town-rpg.firebasestorage.app",
    messagingSenderId: "299530134703",
    appId: "1:299530134703:web:100ac4ecd83e9d60ea605a",
    databaseURL: "https://pet-town-rpg-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);