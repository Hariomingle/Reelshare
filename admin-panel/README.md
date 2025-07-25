# 🎬 ReelShare Admin Panel

A comprehensive web-based admin dashboard for managing the ReelShare platform. Built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, and **Firebase**.

## 🚀 **Features**

### 📊 **Dashboard Overview**
- **Real-time Metrics**: Users, videos, revenue, engagement stats
- **Interactive Charts**: Revenue trends, user growth analytics
- **Recent Activity**: Live feed of platform activities
- **Quick Actions**: Direct access to common admin tasks

### 👥 **User Management**
- **User Profiles**: View detailed user information and activity
- **Account Actions**: Ban, suspend, verify, or manage user accounts
- **Creator Analytics**: Track creator performance and earnings
- **Bulk Operations**: Manage multiple users simultaneously

### 🎥 **Content Moderation**
- **Video Review**: Preview, approve, or reject uploaded content
- **AI Analysis**: View AI-powered content analysis and confidence scores
- **Report Management**: Handle user reports and flagged content
- **Batch Actions**: Moderate multiple videos at once

### 💰 **Revenue Management**
- **Payout Processing**: Approve and manage creator payouts
- **Revenue Analytics**: Track ad revenue, splits, and trends
- **Transaction History**: Detailed financial transaction logs
- **Export Reports**: Generate financial reports for accounting

### 📈 **Analytics & Insights**
- **Platform Metrics**: Comprehensive performance analytics
- **Content Trends**: Trending hashtags, categories, and creators
- **User Behavior**: Engagement patterns and user journey analysis
- **Custom Reports**: Generate specific analytics reports

### 🛡️ **Security & Moderation**
- **Content Filtering**: AI-powered inappropriate content detection
- **User Reports**: Handle community reports and violations
- **Platform Safety**: Monitor and maintain platform integrity
- **Automated Moderation**: Set up automated content filtering rules

---

## 🛠️ **Technology Stack**

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with custom theme
- **UI Components**: Headless UI + Custom components
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React icons
- **Backend**: Firebase (Auth, Firestore, Functions, Storage)
- **Deployment**: Vercel (recommended) or any Node.js host

---

## 📦 **Installation & Setup**

### **Prerequisites**
- Node.js 18+ installed
- Firebase project set up
- Git for version control

### **1. Clone and Install**
```bash
# Navigate to the admin panel directory
cd admin-panel

# Install dependencies
npm install

# or with yarn
yarn install
```

### **2. Environment Configuration**
Create a `.env.local` file in the admin-panel directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Admin Configuration
ADMIN_EMAIL=admin@yourcompany.com
ADMIN_PASSWORD=your-secure-password

# Optional: OpenAI API for enhanced AI features
OPENAI_API_KEY=your-openai-api-key
```

### **3. Firebase Setup**

#### **a) Enable Required Services**
In your Firebase Console:
1. **Authentication**: Enable Email/Password and Google sign-in
2. **Firestore**: Create database in production mode
3. **Storage**: Enable for file uploads
4. **Functions**: Deploy the functions from the main project
5. **Hosting** (optional): For deployment

#### **b) Firestore Security Rules**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Admin users only
    match /{document=**} {
      allow read, write: if request.auth != null && 
        request.auth.token.email in [
          'admin@yourcompany.com',
          'moderator@yourcompany.com'
        ];
    }
  }
}
```

#### **c) Create Admin User**
In Firebase Console > Authentication, manually create an admin user with your email.

### **4. Development**
```bash
# Start development server
npm run dev

# Open browser
http://localhost:3000
```

### **5. Build for Production**
```bash
# Build the application
npm run build

# Start production server
npm start
```

---

## 🎨 **UI/UX Features**

### **🌓 Dark/Light Mode**
- Automatic system preference detection
- Manual theme toggle
- Persistent theme selection
- Consistent styling across all components

### **📱 Responsive Design**
- Mobile-first approach
- Tablet and desktop optimized
- Collapsible sidebar navigation
- Touch-friendly interface

### **⚡ Performance**
- Server-side rendering (SSR)
- Optimized images and assets
- Lazy loading for large datasets
- Efficient data fetching

### **🎯 Accessibility**
- WCAG 2.1 compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast support

---

## 📊 **Dashboard Pages**

### **1. Main Dashboard (`/`)**
- Platform overview with key metrics
- Revenue and user growth charts
- Recent activity feed
- Quick action buttons

### **2. Users (`/users`)**
- User list with search and filtering
- Individual user profiles
- Account management actions
- Creator verification tools

### **3. Content (`/content`)**
- Video grid with previews
- Content moderation tools
- AI analysis results
- Bulk approval/rejection

### **4. Revenue (`/revenue`)**
- Financial dashboard
- Payout processing
- Transaction history
- Revenue analytics

### **5. Analytics (`/analytics`)**
- Detailed platform metrics
- Custom date range selection
- Export functionality
- Trend analysis

### **6. Reports (`/reports`)**
- User report management
- Content flagging system
- Moderation queue
- Resolution tracking

### **7. Settings (`/settings`)**
- Platform configuration
- Admin user management
- Moderation settings
- API configurations

---

## 🔧 **Configuration**

### **Customization**
The admin panel is highly customizable. You can modify:

#### **Theme Colors** (`tailwind.config.js`)
```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: '#FF6B35', // Your brand color
        // ... other shades
      }
    }
  }
}
```

#### **Dashboard Metrics** (`pages/index.tsx`)
```typescript
// Add your custom metrics
const customStats = {
  totalCustomers: await getCustomerCount(),
  activeSubscriptions: await getSubscriptionCount(),
  // ... your metrics
};
```

#### **Navigation Menu** (`components/layout/DashboardLayout.tsx`)
```typescript
const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Your Custom Page', href: '/custom', icon: CustomIcon },
  // ... add your pages
];
```

---

## 🔐 **Security Features**

### **Authentication**
- Firebase Authentication integration
- Admin role verification
- Session management
- Secure token handling

### **Authorization**
- Role-based access control
- Protected routes
- API endpoint security
- Admin-only functions

### **Data Protection**
- Input validation and sanitization
- XSS protection
- CSRF prevention
- Secure headers

---

## 📱 **Mobile Experience**

The admin panel is fully responsive and works great on mobile devices:

- **Touch Optimized**: Large touch targets and gestures
- **Mobile Navigation**: Collapsible sidebar with overlay
- **Optimized Charts**: Mobile-friendly data visualization
- **Quick Actions**: Easy access to common tasks

---

## 🚀 **Deployment**

### **Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Configure custom domain if needed
```

### **Manual Deployment**
```bash
# Build the application
npm run build

# Upload the .next folder and package.json to your server
# Run: npm start
```

### **Docker Deployment**
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🔧 **Development Guide**

### **Adding New Pages**
1. Create page file in `pages/` directory
2. Add to navigation in `DashboardLayout.tsx`
3. Implement with TypeScript interfaces
4. Add proper error handling

### **Custom Components**
```typescript
// components/custom/MyComponent.tsx
import React from 'react';

interface MyComponentProps {
  title: string;
  data: any[];
}

const MyComponent: React.FC<MyComponentProps> = ({ title, data }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      {/* Your component content */}
    </div>
  );
};

export default MyComponent;
```

### **Firebase Integration**
```typescript
// lib/firebase-admin.ts
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

export const adminDb = getFirestore();
```

---

## 📊 **Analytics Integration**

### **Firebase Analytics**
The admin panel includes Firebase Analytics integration for tracking:
- Page views and user interactions
- Admin user behavior
- Performance metrics
- Error tracking

### **Custom Events**
```typescript
// Track custom admin actions
import { logEvent } from 'firebase/analytics';

const trackAdminAction = (action: string, details: any) => {
  logEvent(analytics, 'admin_action', {
    action_type: action,
    details: JSON.stringify(details),
    timestamp: new Date().toISOString(),
  });
};
```

---

## 🐛 **Troubleshooting**

### **Common Issues**

#### **Firebase Connection**
```bash
# Check Firebase configuration
npm run firebase:config

# Test connection
npm run firebase:test
```

#### **Build Errors**
```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

#### **TypeScript Errors**
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Update type definitions
npm install @types/react@latest @types/react-dom@latest
```

---

## 📈 **Performance Optimization**

### **Bundle Analysis**
```bash
# Analyze bundle size
npm run analyze

# Optimize images
npm run optimize-images

# Check performance
npm run lighthouse
```

### **Caching Strategy**
- Static assets cached for 1 year
- API responses cached for 5 minutes
- User data cached for 1 minute
- Real-time data not cached

---

## 🤝 **Contributing**

### **Code Style**
- Use TypeScript for all new code
- Follow ESLint and Prettier rules
- Write tests for new features
- Document components with JSDoc

### **Pull Request Process**
1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Code review and merge

---

## 📄 **License**

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🆘 **Support**

### **Documentation**
- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### **Community**
- GitHub Issues for bug reports
- Discussions for feature requests
- Discord community for chat support

---

## 🎯 **Roadmap**

### **Upcoming Features**
- [ ] **Advanced Analytics**: More detailed insights and reports
- [ ] **Automated Moderation**: AI-powered content filtering
- [ ] **Multi-language Support**: Internationalization
- [ ] **API Management**: RESTful API for third-party integrations
- [ ] **Audit Logs**: Detailed admin action tracking
- [ ] **Export Tools**: Data export in multiple formats

### **Future Enhancements**
- [ ] **Machine Learning**: Predictive analytics and recommendations
- [ ] **Real-time Notifications**: WebSocket-based updates
- [ ] **Advanced Reporting**: Custom dashboard builder
- [ ] **Integration Marketplace**: Third-party service integrations

---

**🎉 Your ReelShare Admin Panel is ready to manage your platform effectively!**

For technical support or questions, please reach out to the development team or create an issue in the repository.

---

**Built with ❤️ for the ReelShare Platform** 