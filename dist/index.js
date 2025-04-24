import * as readline from 'readline';
// Create interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
// Simple console app
function startApp() {
    console.log('\nWelcome to the TypeScript Console App!');
    console.log('------------------------------------\n');
    rl.question('What is your name? ', (name) => {
        console.log(`\nHello, ${name}!`);
        rl.question('\nWould you like to continue? (yes/no) ', (answer) => {
            if (answer.toLowerCase() === 'yes') {
                console.log('\nGreat! Let\'s continue...');
                // Add more functionality here
            }
            else {
                console.log('\nGoodbye!');
            }
            rl.close();
        });
    });
}
startApp();
