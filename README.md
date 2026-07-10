<div style="display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 25px;">
  <div style="display: flex; align-items: center; gap: 35px;">
    <img width="128" height="128" src="./images/logo.png" alt="WordGrid Logo" style="margin: 0; object-fit: contain;">
    <h1 style="margin: 0; border-bottom: none; padding-bottom: 0; font-size: 40px;">WordGrid</h1>
  </div>

  <p style="margin: 0; font-size: 18px; text-align: center;">A grid-based puzzle game to test your vocabulary</p>

  <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
    <img height="20" src="https://api.netlify.com/api/v1/badges/ae1f19af-4ebb-4756-82e7-28a3cd5f5dd3/deploy-status" alt="Netlify Status" style="height: 20px; width: auto;">
    <img height="20" src="https://img.shields.io/github/repo-size/wordgrid-game/wordgrid" alt="GitHub repo size" style="height: 20px; width: auto;">
    <img height="20" src="https://img.shields.io/github/issues/wordgrid-game/wordgrid" alt="GitHub Issues" style="height: 20px; width: auto;">
    <img height="20" src="https://img.shields.io/github/issues-pr/wordgrid-game/wordgrid" alt="GitHub Pull Requests" style="height: 20px; width: auto;">
    <img height="20" src="https://img.shields.io/github/contributors-anon/wordgrid-game/wordgrid" alt="GitHub contributors" style="height: 20px; width: auto;">
    <img height="20" src="https://img.shields.io/github/commit-activity/t/wordgrid-game/wordgrid" alt="GitHub commit activity" style="height: 20px; width: auto;">
  </div>
</div>

## Setting up Local Development

To setup local development, clone the repository and then install the dependencies for both the client and server. Please note that [Bun](https://bun.sh) is used for the server.

> If you are using an editor that does not have built-in support for `.editorconfig` files (e.g. VSCode), please install an extension that provides support for it (e.g. [EditorConfig for VSCode](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig)) to follow the style guidelines for this repository.

```bash
git clone https://github.com/wordgrid-game/wordgrid.git
cd wordgrid
npm install
cd server
bun install
cd ..
```

## Core Architecture

The root directory is for the client (our website), with a subdirectory (`server`) for the backend service.

## License

We use a custom source-available license. Please read it over [here](./LICENSE.md).

## Contributing

Please follow the contribution guide [here](./CONTRIBUTING.md).

## Code of Conduct

Please respect our community and maintainers by following the standards set out in our [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Follow the [security policy](./SECURITY.md) and use GitHub's built in security vulnerability reporting system if you find any security issues.

## Contributors

<a href="https://github.com/wordgrid-game/wordgrid/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=wordgrid-game/wordgrid" alt="WordGrid Contributors" />
</a>
