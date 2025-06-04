export const awsConfig = {
    Auth: {
        region: 'eu-west-2',
        userPoolId: 'eu-west-2_LBU472pes',
        userPoolWebClientId: '5gg382oqd9sknjnv9fa0hr0km2',
    },
    API: {
        endpoints: [
            { name: 'wallet', endpoint: 'https://abc123.execute-api.eu-west-2.amazonaws.com' }
        ]
    }
};

export default awsConfig;
