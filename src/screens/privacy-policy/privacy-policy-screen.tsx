import React from 'react';
import { View } from 'react-native';
import { AppText, ScreenContainer } from '@/components';
import { COLORS, VARS } from '@/lib/constants';

export const PrivacyPolicyScreen: React.FC = () => {
  return (
    <ScreenContainer scrollable>
      <View style={{ padding: VARS.medium }}>
        <AppText style={{ fontSize: 24, fontWeight: '700', marginBottom: VARS.small }}>
          Privacy Policy
        </AppText>

        <AppText style={{ color: COLORS.textSecondary, marginBottom: VARS.medium }}>
          Last updated: 14 December 2025
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Introduction
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          Clean City (“we”, “our”, or “us”) values your privacy. This Privacy Policy explains how our
          mobile application (“the App”) collects, uses, and protects information when you use our
          services.
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Information We Collect
        </AppText>

        <AppText style={{ fontSize: 16, fontWeight: '600', marginBottom: VARS.xxsmall }}>
          1. Account & Authentication Information
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          When you create an account or sign in, we may collect:
          {'\n'}• Email address
          {'\n'}• Basic account identifiers (such as a user ID)
          {'\n\n'}
          This information is used solely to:
          {'\n'}• Create and manage your account
          {'\n'}• Authenticate users
          {'\n'}• Provide access to app features
          {'\n\n'}
          We do not collect profile photos, contacts, or social media data.
        </AppText>

        <AppText style={{ fontSize: 16, fontWeight: '600', marginBottom: VARS.xxsmall }}>
          2. Payment Information
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          Payments are processed securely through third-party payment providers.
          {'\n\n'}
          We do not store or have access to your full payment details, such as:
          {'\n'}• Card numbers
          {'\n'}• Bank account information
          {'\n'}• Security codes
          {'\n\n'}
          Payment providers may collect:
          {'\n'}• Transaction amount
          {'\n'}• Payment method
          {'\n'}• Billing confirmation
          {'\n\n'}
          These providers handle your payment information in accordance with their own privacy
          policies and security standards.
        </AppText>

        <AppText style={{ fontSize: 16, fontWeight: '600', marginBottom: VARS.xxsmall }}>
          3. Analytics (Coming Soon)
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          In future versions of the App, we may introduce analytics tools to help us understand how
          users interact with the App.
          {'\n\n'}
          When enabled, analytics may collect:
          {'\n'}• App usage data (e.g. screens viewed, features used)
          {'\n'}• Device information (such as OS version and device type)
          {'\n'}• Anonymous performance and error data
          {'\n\n'}
          Analytics data will:
          {'\n'}• Be used only to improve app performance and user experience
          {'\n'}• Not be used for advertising or tracking across other apps
          {'\n\n'}
          We will update this Privacy Policy before enabling analytics.
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Data We Do Not Collect
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          We do not collect:
          {'\n'}• Location data
          {'\n'}• Camera or microphone data
          {'\n'}• Photos or media files
          {'\n'}• Contacts
          {'\n'}• Messages or call logs
          {'\n'}• Tracking data across apps or websites
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Third-Party Services
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          The App uses trusted third-party services for:
          {'\n'}• Authentication
          {'\n'}• Payment processing
          {'\n\n'}
          These services only receive the information necessary to perform their function and are
          required to protect your data.
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Data Security
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          We take reasonable measures to protect your information, including:
          {'\n'}• Secure authentication practices
          {'\n'}• Encrypted communication
          {'\n'}• Relying on trusted, compliant third-party providers
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Children’s Privacy
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          The App is not intended for children under the age of 13. We do not knowingly collect
          personal data from children.
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Changes to This Policy
        </AppText>
        <AppText style={{ marginBottom: VARS.small, color: COLORS.textSecondary }}>
          We may update this Privacy Policy from time to time. Any changes will be posted within the
          App or on our website, and the “Last updated” date will be revised.
        </AppText>

        <AppText style={{ fontSize: 18, fontWeight: '600', marginBottom: VARS.small }}>
          Contact Us
        </AppText>
        <AppText style={{ marginBottom: VARS.large, color: COLORS.textSecondary }}>
          If you have questions about this Privacy Policy or your data, contact us at:
          {'\n\n'}
          Email: info@melvinasare.com
          {'\n'}
          Company: Clean City
        </AppText>
      </View>
    </ScreenContainer>
  );
};



