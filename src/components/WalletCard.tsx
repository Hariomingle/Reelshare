import React from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Types and Constants
import { Wallet, WalletTransaction } from '../types';
import { COLORS, FONTS, SPACING, BORDER_RADIUS, WALLET } from '../constants';

interface WalletCardProps {
  wallet: Wallet;
  transactions: WalletTransaction[];
  onWithdraw: () => void;
  onViewTransactions: () => void;
  onReferral: () => void;
}

const WalletCard: React.FC<WalletCardProps> = ({
  wallet,
  transactions,
  onWithdraw,
  onViewTransactions,
  onReferral,
}) => {
  const formatCurrency = (amount: number): string => {
    return `₹${amount.toFixed(2)}`;
  };

  const getTransactionIcon = (type: string, subType: string) => {
    switch (subType) {
      case 'watch':
        return 'eye';
      case 'create':
        return 'videocam';
      case 'referral_signup':
        return 'people';
      case 'daily_streak':
        return 'flame';
      case 'ad_revenue':
        return 'trending-up';
      default:
        return 'wallet';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earning':
      case 'bonus':
      case 'referral':
        return COLORS.earning;
      case 'withdrawal':
        return COLORS.spending;
      default:
        return COLORS.textSecondary;
    }
  };

  const recentTransactions = transactions.slice(0, 5);

  return (
    <View style={styles.container}>
      {/* Main Balance Card */}
      <LinearGradient
        colors={[COLORS.primary, COLORS.primaryDark]}
        style={styles.balanceCard}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.balanceHeader}>
          <View style={styles.balanceInfo}>
            <Text style={styles.balanceLabel}>Total Balance</Text>
            <Text style={styles.balanceAmount}>
              {formatCurrency(wallet.totalBalance)}
            </Text>
            <Text style={styles.availableBalance}>
              Available: {formatCurrency(wallet.availableBalance)}
            </Text>
          </View>
          <View style={styles.walletIcon}>
            <Ionicons name="wallet" size={32} color={COLORS.text} />
          </View>
        </View>

        <View style={styles.balanceActions}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              wallet.availableBalance < WALLET.minWithdrawal &&
                styles.actionButtonDisabled,
            ]}
            onPress={onWithdraw}
            disabled={wallet.availableBalance < WALLET.minWithdrawal}
          >
            <Ionicons name="arrow-up" size={20} color={COLORS.text} />
            <Text style={styles.actionButtonText}>Withdraw</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={onReferral}>
            <Ionicons name="people" size={20} color={COLORS.text} />
            <Text style={styles.actionButtonText}>Refer & Earn</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Earnings Breakdown */}
      <View style={styles.earningsCard}>
        <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
        
        <View style={styles.earningsGrid}>
          <View style={styles.earningItem}>
            <View style={[styles.earningIcon, { backgroundColor: `${COLORS.success}20` }]}>
              <Ionicons name="trending-up" size={20} color={COLORS.success} />
            </View>
            <Text style={styles.earningLabel}>Ad Revenue</Text>
            <Text style={styles.earningAmount}>
              {formatCurrency(wallet.adEarnings)}
            </Text>
            <Text style={styles.earningSubtext}>From actual ads</Text>
          </View>

          <View style={styles.earningItem}>
            <View style={[styles.earningIcon, { backgroundColor: `${COLORS.warning}20` }]}>
              <Ionicons name="gift" size={20} color={COLORS.warning} />
            </View>
            <Text style={styles.earningLabel}>Bonus Earnings</Text>
            <Text style={styles.earningAmount}>
              {formatCurrency(wallet.bonusEarnings)}
            </Text>
            <Text style={styles.earningSubtext}>Fixed rewards</Text>
          </View>

          <View style={styles.earningItem}>
            <View style={[styles.earningIcon, { backgroundColor: `${COLORS.accent}20` }]}>
              <Ionicons name="eye" size={20} color={COLORS.accent} />
            </View>
            <Text style={styles.earningLabel}>Watch Earnings</Text>
            <Text style={styles.earningAmount}>
              {formatCurrency(wallet.watchEarnings)}
            </Text>
            <Text style={styles.earningSubtext}>20% ad share</Text>
          </View>

          <View style={styles.earningItem}>
            <View style={[styles.earningIcon, { backgroundColor: `${COLORS.secondary}20` }]}>
              <Ionicons name="videocam" size={20} color={COLORS.secondary} />
            </View>
            <Text style={styles.earningLabel}>Create Earnings</Text>
            <Text style={styles.earningAmount}>
              {formatCurrency(wallet.createEarnings)}
            </Text>
            <Text style={styles.earningSubtext}>60% ad share + bonus</Text>
          </View>

          <View style={styles.earningItem}>
            <View style={[styles.earningIcon, { backgroundColor: `${COLORS.primary}20` }]}>
              <Ionicons name="people" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.earningLabel}>Referral Bonus</Text>
            <Text style={styles.earningAmount}>
              {formatCurrency(wallet.referralEarnings)}
            </Text>
            <Text style={styles.earningSubtext}>₹10 per signup</Text>
          </View>

          <View style={styles.earningItem}>
            <View style={[styles.earningIcon, { backgroundColor: `${COLORS.info}20` }]}>
              <Ionicons name="flame" size={20} color={COLORS.info} />
            </View>
            <Text style={styles.earningLabel}>Streak Bonus</Text>
            <Text style={styles.earningAmount}>
              {formatCurrency(wallet.streakEarnings)}
            </Text>
            <Text style={styles.earningSubtext}>Daily rewards</Text>
          </View>
        </View>
      </View>

      {/* Statistics */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Earned</Text>
            <Text style={styles.statValue}>
              {formatCurrency(wallet.totalEarned)}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Total Withdrawn</Text>
            <Text style={styles.statValue}>
              {formatCurrency(wallet.totalWithdrawn)}
            </Text>
          </View>
        </View>
        
        <View style={styles.pendingBalance}>
          <Ionicons name="time" size={16} color={COLORS.warning} />
          <Text style={styles.pendingText}>
            Pending: {formatCurrency(wallet.pendingBalance)}
          </Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.transactionsCard}>
        <View style={styles.transactionsHeader}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          <TouchableOpacity onPress={onViewTransactions}>
            <Text style={styles.viewAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.transactionsList} nestedScrollEnabled>
          {recentTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <View
                  style={[
                    styles.transactionIcon,
                    {
                      backgroundColor: `${getTransactionColor(transaction.type)}20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={getTransactionIcon(transaction.type, transaction.subType)}
                    size={16}
                    color={getTransactionColor(transaction.type)}
                  />
                </View>
                <View style={styles.transactionDetails}>
                  <Text style={styles.transactionDescription}>
                    {transaction.description}
                  </Text>
                  <Text style={styles.transactionDate}>
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.transactionRight}>
                <Text
                  style={[
                    styles.transactionAmount,
                    {
                      color: getTransactionColor(transaction.type),
                    },
                  ]}
                >
                  {transaction.type === 'withdrawal' ? '-' : '+'}
                  {formatCurrency(transaction.amount)}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        transaction.status === 'completed'
                          ? `${COLORS.success}20`
                          : transaction.status === 'pending'
                          ? `${COLORS.warning}20`
                          : `${COLORS.error}20`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          transaction.status === 'completed'
                            ? COLORS.success
                            : transaction.status === 'pending'
                            ? COLORS.warning
                            : COLORS.error,
                      },
                    ]}
                  >
                    {transaction.status}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Withdrawal Info */}
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle" size={20} color={COLORS.info} />
          <Text style={styles.infoTitle}>Withdrawal Info</Text>
        </View>
        <Text style={styles.infoText}>
          • Minimum withdrawal amount: ₹{WALLET.minWithdrawal}
        </Text>
        <Text style={styles.infoText}>
          • Processing time: 2-5 business days
        </Text>
        <Text style={styles.infoText}>
          • Watch {WALLET.revenueShare.viewer * 100}% revenue share from ads
        </Text>
        <Text style={styles.infoText}>
          • Create {WALLET.revenueShare.creator * 100}% revenue share from your content
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: SPACING.lg,
  },
  balanceCard: {
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.lg,
  },
  balanceInfo: {
    flex: 1,
  },
  balanceLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
    marginBottom: SPACING.xs,
  },
  balanceAmount: {
    color: COLORS.text,
    fontSize: FONTS.size.display,
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.xs,
  },
  availableBalance: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: FONTS.size.sm,
    fontWeight: FONTS.weight.medium,
  },
  walletIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    gap: SPACING.sm,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },
  earningsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.lg,
  },
  earningsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  earningItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: BORDER_RADIUS.md,
  },
  earningIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  earningLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  earningAmount: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.bold,
    textAlign: 'center',
  },
  earningSubtext: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.xs,
    marginTop: SPACING.xs,
  },
  statsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    marginBottom: SPACING.xs,
  },
  statValue: {
    color: COLORS.text,
    fontSize: FONTS.size.xl,
    fontWeight: FONTS.weight.bold,
  },
  pendingBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  pendingText: {
    color: COLORS.warning,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },
  transactionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    maxHeight: 300,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  viewAllText: {
    color: COLORS.primary,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
  },
  transactionsList: {
    flex: 1,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDescription: {
    color: COLORS.text,
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.medium,
    marginBottom: SPACING.xs,
  },
  transactionDate: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: FONTS.size.md,
    fontWeight: FONTS.weight.bold,
    marginBottom: SPACING.xs,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
  },
  statusText: {
    fontSize: FONTS.size.xs,
    fontWeight: FONTS.weight.medium,
    textTransform: 'capitalize',
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.info,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  infoTitle: {
    color: COLORS.text,
    fontSize: FONTS.size.lg,
    fontWeight: FONTS.weight.semibold,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
});

export default WalletCard; 