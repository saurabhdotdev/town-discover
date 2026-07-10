import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f8fafc",
        tabBarStyle: {
          position: "absolute",
          bottom: 16,
          left: 14,
          right: 14,
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          borderWidth: 1,
          borderColor: "rgba(45, 212, 191, 0.15)",
          borderRadius: 24,
          height: 60,
          paddingBottom: 6,
          paddingTop: 6,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 6,
        },
        tabBarActiveTintColor: "#2dd4bf",
        tabBarInactiveTintColor: "#64748b",
        tabBarLabelStyle: { fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explore",
          tabBarIcon: ({ color, size }) => <Ionicons name="compass" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, size }) => <Ionicons name="trail-sign" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="hangouts"
        options={{
          title: "Hangouts",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Ranks",
          tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}

