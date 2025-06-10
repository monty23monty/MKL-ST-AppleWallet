const awsConfig = {
    Auth: {
        Cognito: {
            userPoolId:        'eu-west-2_LBU472pes',
            userPoolClientId:  '4edcgssa3j6jfeflfrfpq6j62d',




            // optional but silences warnings and lets Amplify know users sign in with e-mail
            loginWith: {
                email:    true,
                username: false,
                phone:    false,
            },
        },
    },


    API: {
        REST: {
            /** name MUST match the apiName you use in the code below */
            wallet: {
                endpoint: 'https://bnlji95zgg.execute-api.eu-west-2.amazonaws.com',
                region:   'eu-west-2',                // optional, but good practice
            },
        },
    },
};


export default awsConfig;