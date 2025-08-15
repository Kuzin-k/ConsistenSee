# ConsistenSee Plugin

## Overview

ConsistenSee is a Figma plugin designed to help maintain design system consistency. It scans your Figma files for outdated components, detached instances, and incorrect color styles, providing a comprehensive overview of your project's health.

The plugin is currently undergoing a refactoring to TypeScript to improve modularity, maintainability, and type safety.

## Features

- **Outdated Instances Check:** Finds all instances that are not up-to-date with their main components.
- **Detached Instances Check:** (Planned) Will identify instances that have been detached from their main components.
- **Color Style Analysis:** Scans for incorrect usage of color styles.
- **Icon Review:** Helps to check and validate icons.
- **Deprecated Components:** (Planned) Will flag components that are marked as deprecated.
- **Project Statistics:** Displays overall statistics of the components and styles used in the file.

## Project Structure

The project is structured as follows:

- `src/js/index.ts`: The main plugin logic (backend) that interacts with the Figma API.
- `src/ui/ui.html`: The user interface of the plugin.
- `src/ui/ui.css`: The styles for the user interface.
- `src/js/component/`: Modules for working with components.
- `src/js/color/`: Modules for handling color styles.
- `src/js/update/`: Modules for checking for plugin updates.
- `src/js/utils/`: Utility functions.
- `manifest.json`: The plugin manifest file.
- `tsconfig.json`: TypeScript configuration.
- `webpack.config.js`: Webpack configuration for building the plugin.

## Installation

1.  Clone the repository.
2.  Install dependencies: `npm install`
3.  Build the plugin: `npm run build`
4.  In Figma, go to `Plugins -> Development -> Import plugin from manifest...` and select the `manifest.json` file from the `dist` directory.

## Usage

1.  Open a Figma file.
2.  Run the ConsistenSee plugin.
3.  Click on "New search" to scan the document.
4.  The plugin will display a list of issues found, categorized by type (outdated, colors, etc.).
5.  Click on an issue to select the corresponding layer in the Figma canvas.

## Contributing

Contribution guidelines are yet to be defined. For now, feel free to open issues and pull requests.
