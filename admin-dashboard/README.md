# Admin Dashboard

A comprehensive React.js admin dashboard for educational platform management with full Arabic/English support.

## Features

- 🌐 **Bilingual Support**: Full Arabic and English translations with RTL/LTR layout
- 🎨 **Modern UI**: Beautiful design with light/dark theme support
- 📱 **Responsive**: Works seamlessly on desktop, tablet, and mobile devices
- ⚡ **Fast**: Built with Vite for optimal performance
- 🎯 **Feature-Rich**: Complete modules for managing students, teachers, courses, and more

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool
- **React Router v6** - Routing
- **i18next** - Internationalization
- **Axios** - HTTP client
- **Lucide React** - Beautiful icons
- **Vanilla CSS** - Styling with CSS variables

## Getting Started

### Prerequisites

- Node.js 16+ and npm

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── assets/
│   └── styles/          # Global styles and design system
├── components/
│   ├── common/          # Reusable components (Button, Card, Input, etc.)
│   └── layout/          # Layout components (Sidebar, Header, MainLayout)
├── contexts/            # React contexts (Auth, Theme, Language)
├── locales/             # Translation files (ar.json, en.json)
├── pages/               # Page components
│   ├── students/
│   ├── teachers/
│   ├── courses/
│   └── ...
├── services/            # API service layer
└── utils/               # Utility functions
```

## Modules

- **Dashboard**: Overview with statistics and recent activities
- **Students**: Student management with CRUD operations
- **Teachers**: Teacher management and course assignments
- **Courses**: Course management with videos and sections
- **Permissions**: Role-based access control
- **Subscriptions**: Subscription plans and management
- **Academic Structure**: Departments, years, semesters, and subjects
- **Settings**: System configuration

## API Integration

The application is structured with a dedicated API service layer in `src/services/api.js`. Update the `baseURL` to point to your backend API:

```javascript
const api = axios.create({
  baseURL: 'YOUR_API_URL_HERE',
  // ...
});
```

## Customization

### Theme

Customize colors and design tokens in `src/assets/styles/variables.css`

### Translations

Add or modify translations in:
- `src/locales/ar.json` (Arabic)
- `src/locales/en.json` (English)

## License

MIT
