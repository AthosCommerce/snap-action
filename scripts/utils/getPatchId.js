const constants = require('./constants');

function getPatchId(commitMessage, branch) {
    let id, version;
    const { BRANCH_PREFIX, REVERT_BRANCH_PREFIX } = constants;

    if (branch == 'production' && commitMessage.includes(`from snap-implementations/${BRANCH_PREFIX}`)) {
        version = commitMessage.split(BRANCH_PREFIX).pop().split('\n').shift();
        id = BRANCH_PREFIX + version;
    } else if (branch == 'production' && commitMessage.includes(`from snap-implementations/${REVERT_BRANCH_PREFIX}`)) {
        version = commitMessage.split(REVERT_BRANCH_PREFIX).pop().split('\n').shift();
        id = REVERT_BRANCH_PREFIX + version;
    } else if (branch.includes(BRANCH_PREFIX)) {
        id = branch;
    } else if (branch.includes(REVERT_BRANCH_PREFIX)) {
        id = branch;
    }

    return { id, version };
}

module.exports = getPatchId;