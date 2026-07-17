// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB5omh7FX0xHi_uVlVah1gFP17fLL9FPpw",
  authDomain: "yourtube-942e9.firebaseapp.com",
  projectId: "yourtube-942e9",
  storageBucket: "yourtube-942e9.firebasestorage.app",
  messagingSenderId: "342293030237",
  appId: "1:342293030237:web:791d9998d0bc53254df4b4",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
export { auth, provider };
