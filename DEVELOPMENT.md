## Local Development
Using Nektos Act for development/testing of Github composite action (requires Docker).

Helpful Github action docs:
https://docs.github.com/en/actions/learn-github-actions/contexts
https://docs.github.com/en/actions/learn-github-actions/expressions

### Docker
Using a locally built Docker image for Act testing.

Build Docker image:
```sh
docker build -t snap-runner-local ./
```

### Act
https://github.com/nektos/act

Install Act:
```sh
brew install act
```

Test `push` action:
```sh
act push
```

Test `pull_request` action:
```sh
act pull_request
```

### .env
This file should contain any environment variables needed to be passed into the `development.yml` action. The repository and branch can be changed as needed to conduct testing. Be aware that the S3 uploading will occur if the AWS secrets are provided - this could be detrimental to live sites, use with care!

```
GITHUB_REPOSITORY=snap-implementations/snap.searchspring.io
GITHUB_REPOSITORY_BRANCH=testing
```

### .secrets
Any secrets to be passed to the action should be present here.
At minimum you will need a Github token with permissions to checkout the repository to run the action on.

```
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

A more complete `.secrets` file would include many more secrets.

```
GITHUB_TOKEN=
WEBSITE_SECRET_KEY=
WEBSITE_SECRET_KEY_A1B2C3=
MACHINE_TOKEN=
SNAPFU_AWS_BUCKET=
SNAPFU_AWS_DISTRIBUTION_ID=
SNAPFU_AWS_KEY_ID=
SNAPFU_AWS_SECRET_ACCESS_KEY=
```