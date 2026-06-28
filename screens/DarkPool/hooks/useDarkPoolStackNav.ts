import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DarkPoolStackParamList } from '../../../navigation/DarkPoolStack';

const STACK_ROUTE_NAMES = new Set(['DarkPoolHome', 'DarkPoolTicker', 'DarkPoolInvestor']);

type NavLike = {
  getState?: () => { routeNames?: string[] } | undefined;
  getParent?: () => NavLike | undefined;
};

function findDarkPoolStackNav(
  navigation: NavLike
): NativeStackNavigationProp<DarkPoolStackParamList> | null {
  let current: NavLike | undefined = navigation;

  while (current) {
    const routeNames = current.getState?.()?.routeNames ?? [];
    if (routeNames.some((name: string) => STACK_ROUTE_NAMES.has(name))) {
      return current as unknown as NativeStackNavigationProp<DarkPoolStackParamList>;
    }
    current = current.getParent?.() ?? undefined;
  }

  return null;
}

export function useDarkPoolStackNav() {
  const navigation = useNavigation();
  const stackNav = findDarkPoolStackNav(navigation as NavLike);
  return stackNav ?? (navigation as unknown as NativeStackNavigationProp<DarkPoolStackParamList>);
}
