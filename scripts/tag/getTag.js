const exit = require('process').exit;
const getCliArgs = require('../utils/getCliArgs');
const cmp = require('../utils/cmp');
const constants = require('../utils/constants');

const { REVERT_BRANCH_PREFIX } = constants;

(async function () {
    try {
        const args = getCliArgs(['tags', 'commitMessage']);

        if(!args.tags) {
            console.error("getTag.js did not recieve any tags")
            exit(1);
        }

        if(!args.commitMessage) {
            console.error("getTag.js did not recieve any commitMessage")
            exit(1);
        }

        const { commitMessage } = args;

        const tags = args.tags.split('\n').map(tag => tag.trim()).filter(tag => tag);
        tags.sort(cmp);
        

        if (commitMessage.includes(`from snap-implementations/${REVERT_BRANCH_PREFIX}`)) {
            const version = commitMessage.split(REVERT_BRANCH_PREFIX).pop().split('\n').shift();
            if(tags.includes(version)) {
                console.log(version);
                exit(0);
            }
        }

        throw new Error(`Could not find tag we reverted from within commitMessage`);

    } catch (err) {
        console.error('Error during getTag.js');
        console.error(err);
        exit(1);
    }
})();