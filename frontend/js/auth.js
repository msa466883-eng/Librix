// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAPBCiADmra2VTiSFpbnSENHOYY_Yjzh_w",
    authDomain: "algorithm-predictor-v2.firebaseapp.com",
    databaseURL: "https://algorithm-predictor-v2-default-rtdb.firebaseio.com",
    projectId: "algorithm-predictor-v2",
    storageBucket: "algorithm-predictor-v2.appspot.com",
    messagingSenderId: "306571593528",
    appId: "1:306571593528:web:ebddd1b279c54681ad63cd"
};

// Initialize Firebase Realtime DB
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

const Auth = {
    init: function () {
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const keyInput = document.getElementById('license-key-input').value.trim();
                await this.login(keyInput);
            });
        }
    },

    isLoggedIn: function () {
        return localStorage.getItem('kutub_license_key') !== null;
    },

    getToken: function () {
        return localStorage.getItem('kutub_license_key') || '';
    },

    login: function (userKey) {
        const errorElement = document.getElementById('login-error');
        const errorText = document.getElementById('error-text');
        
        if (!userKey) {
            errorText.textContent = "Please enter a key!";
            errorElement.classList.remove('hidden');
            return;
        }

        // Verify License Key against Firebase DB
        db.ref('keys').orderByChild('key').equalTo(userKey).once('value', (snapshot) => {
            if (!snapshot.exists()) {
                errorText.textContent = "Invalid License Key!";
                errorElement.classList.remove('hidden');
                return;
            }

            let isValid = false;
            let failureMsg = "";

            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();

                if (data.status !== 'Active') {
                    failureMsg = "License Key is Inactive or Disabled!";
                } else if (data.expiresAt && Date.now() > data.expiresAt) {
                    failureMsg = "License Key has Expired!";
                } else {
                    isValid = true;
                }
            });

            if (isValid) {
                errorElement.classList.add('hidden');
                localStorage.setItem('kutub_license_key', userKey);
                location.reload();
            } else {
                errorText.textContent = failureMsg || "Invalid License Key!";
                errorElement.classList.remove('hidden');
            }
        });
    },

    logout: function () {
        localStorage.removeItem('kutub_license_key');
        location.reload();
    }
};
