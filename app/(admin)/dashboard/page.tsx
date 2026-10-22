
import { connection } from "next/server";
import { requireSuperadmin } from "@/lib/auth/require-superadmin";

export const instant = false;

const voteChoices = [
  {
    value: "a",
    label: "Caption A",
    color: "bg-blue-400",
  },
  {
    value: "b",
    label: "Caption B",
    color: "bg-violet-400",
  },
  {
    value: "both",
    label: "Both",
    color: "bg-emerald-400",
  },
  {
    value: "neither",
    label: "Neither",
    color: "bg-amber-400",
  },
] as const;

export default async function DashboardPage() {
  // Render using the current request, not during prerendering.
  await connection();

  // All admin data access happens after server-side authorization.
  const { supabase, user } = await requireSuperadmin();

  // Get exact counts without downloading all records.
  const [profiles, battles, captions, votes] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("generation_sets").select("*", { count: "exact", head: true }),
    supabase.from("generations").select("*", { count: "exact", head: true }),
    supabase.from("votes").select("*", { count: "exact", head: true }),
  ]);

  // Count each vote category directly in the database.
  const choiceResults = await Promise.all(
    voteChoices.map((choice) =>
      supabase
        .from("votes")
        .select("*", { count: "exact", head: true })
        .eq("choice", choice.value)
    )
  );

  // Build seven UTC calendar-day intervals, including today.
  const now = new Date();

  const todayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );

  const days = Array.from({ length: 7 }, (_, index) => {
    const start = new Date(
      todayUTC - (6 - index) * 86_400_000
    );

    const end = new Date(
      start.getTime() + 86_400_000
    );

    return {
      key: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
      }),
      date: start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      from: start.toISOString(),
      to: end.toISOString(),
    };
  });

  // Exact daily counts; no vote records need to be downloaded.
  const dailyVoteResults = await Promise.all(
    days.map((day) =>
      supabase
        .from("votes")
        .select("*", { count: "exact", head: true })
        .gte("created_at", day.from)
        .lt("created_at", day.to)
    )
  );

  const queryError = [
    profiles,
    battles,
    captions,
    votes,
    ...choiceResults,
    ...dailyVoteResults,
  ].find((result) => result.error);

  if (queryError?.error) {
    console.error(
      "Admin dashboard query failed:",
      queryError.error
    );
    throw new Error("Unable to load dashboard statistics.");
  }

  const totalVotes = votes.count ?? 0;

  const statistics = [
    {
      label: "Registered users",
      value: profiles.count ?? 0,
      description: "Total user profiles",
    },
    {
      label: "Caption battles",
      value: battles.count ?? 0,
      description: "Generated image matchups",
    },
    {
      label: "AI captions",
      value: captions.count ?? 0,
      description: "Generated caption candidates",
    },
    {
      label: "Total votes",
      value: totalVotes,
      description: "Community voting activity",
    },
  ];

  const distribution = voteChoices.map((choice, index) => {
    const count = choiceResults[index].count ?? 0;

    return {
      ...choice,
      count,
      percentage:
        totalVotes > 0 ? (count / totalVotes) * 100 : 0,
    };
  });

  const bothOrNeither = distribution
    .filter(
      (choice) =>
        choice.value === "both" ||
        choice.value === "neither"
    )
    .reduce((total, choice) => total + choice.count, 0);

  const bothOrNeitherPercentage =
    totalVotes > 0
      ? (bothOrNeither / totalVotes) * 100
      : 0;

  const dailyActivity = days.map((day, index) => ({
    ...day,
    count: dailyVoteResults[index].count ?? 0,
  }));

  const weeklyVotes = dailyActivity.reduce(
    (sum, day) => sum + day.count,
    0
  );

  const maximumDailyVotes = Math.max(
    1,
    ...dailyActivity.map((day) => day.count)
  );

  // Engagement insights use existing query results.
  // No additional Supabase queries are needed.
  const totalBattles = battles.count ?? 0;

  const votesA = choiceResults[0].count ?? 0;
  const votesB = choiceResults[1].count ?? 0;

  const averageVotesPerBattle =
    totalBattles > 0
      ? totalVotes / totalBattles
      : 0;

  const singleCaptionPercentage =
    totalVotes > 0
      ? ((votesA + votesB) / totalVotes) * 100
      : 0;

  const leadingCaption =
    votesA === 0 && votesB === 0
      ? "No votes"
      : votesA === votesB
        ? "Tie"
        : votesA > votesB
          ? "Caption A"
          : "Caption B";

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-6 py-12">
      <header className="space-y-4">
        <p className="text-sm font-semibold tracking-[0.2em] text-gray-500">
          CAPTION ARENA ADMIN
        </p>

        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Dashboard
        </h1>

        <p className="text-gray-400">
          An overview of your Caption Arena community.
        </p>

        <p className="text-xs text-gray-500">
          Signed in as {user.email}
        </p>
      </header>

      {/* Platform overview */}
      <section className="mt-12">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            Platform overview
          </h2>

          <span className="text-xs text-gray-500">
            Live database statistics
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statistics.map((stat) => (
            <article
              key={stat.label}
              className="rounded-2xl border border-white/15 bg-white/[0.03] p-6"
            >
              <p className="text-sm font-medium text-gray-400">
                {stat.label}
              </p>

              <p className="mt-5 text-4xl font-bold tracking-tight tabular-nums">
                {stat.value.toLocaleString("en-US")}
              </p>

              <p className="mt-3 text-xs text-gray-500">
                {stat.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Voting activity */}
      <section className="mt-8 rounded-2xl border border-white/15 bg-white/[0.02] p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
              Engagement over time
            </p>

            <h2 className="mt-3 text-xl font-semibold">
              Voting activity
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              Daily votes over the last seven UTC calendar days.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3">
            <p className="text-xs text-gray-500">
              Last 7 days
            </p>

            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {weeklyVotes.toLocaleString("en-US")}
            </p>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-7 gap-2 sm:gap-5">
          {dailyActivity.map((day) => {
            const height =
              day.count > 0
                ? Math.max(
                    8,
                    (day.count / maximumDailyVotes) * 100
                  )
                : 0;

            return (
              <div
                key={day.key}
                className="flex min-w-0 flex-col items-center"
                title={`${day.date}: ${day.count} votes`}
              >
                <span className="mb-3 text-xs font-medium tabular-nums text-gray-300">
                  {day.count}
                </span>

                <div className="flex h-40 w-full max-w-20 items-end overflow-hidden rounded-lg bg-white/[0.04]">
                  <div
                    className="w-full rounded-t-lg bg-indigo-400/80 transition-all"
                    style={{ height: `${height}%` }}
                    role="img"
                    aria-label={`${day.date}: ${day.count} votes`}
                  />
                </div>

                <span className="mt-3 text-xs font-medium text-gray-300">
                  {day.label}
                </span>

                <span className="mt-1 text-[10px] text-gray-500">
                  {day.date}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-7 border-t border-white/10 pt-5">
          <p className="text-xs leading-6 text-gray-500">
            Counts are calculated directly from Supabase.
            Today&apos;s total is still in progress.
            Dates use UTC.
          </p>
        </div>
      </section>

      {/* NEW: Engagement insights */}
      <section className="mt-8">
        <div className="mb-5">
          <h2 className="text-xl font-semibold">
            Engagement insights
          </h2>

          <p className="mt-2 text-sm text-gray-400">
            How the community interacts with generated captions.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
            <p className="text-sm text-gray-400">
              Votes per battle
            </p>

            <p className="mt-4 text-4xl font-bold tabular-nums">
              {averageVotesPerBattle.toFixed(1)}
            </p>

            <p className="mt-3 text-xs text-gray-500">
              Average across all generated battles
            </p>
          </article>

          <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
            <p className="text-sm text-gray-400">
              Single-caption choices
            </p>

            <p className="mt-4 text-4xl font-bold tabular-nums">
              {singleCaptionPercentage.toFixed(1)}%
            </p>

            <p className="mt-3 text-xs text-gray-500">
              Votes selecting Caption A or B
            </p>
          </article>

          <article className="rounded-2xl border border-white/15 bg-white/[0.03] p-6">
            <p className="text-sm text-gray-400">
              Leading caption
            </p>

            <p className="mt-4 text-3xl font-bold">
              {leadingCaption}
            </p>

            <p className="mt-3 text-xs text-gray-500">
              {votesA} votes for A · {votesB} votes for B
            </p>
          </article>
        </div>
      </section>

      {/* Voting distribution */}
      <section className="mt-8 rounded-2xl border border-white/15 bg-white/[0.02] p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">
              Voting distribution
            </h2>

            <p className="mt-2 text-sm text-gray-400">
              How the community votes on AI captions.
            </p>
          </div>

          <span className="rounded-full border border-white/15 px-3 py-1 text-sm text-gray-400">
            {totalVotes.toLocaleString("en-US")} votes
          </span>
        </div>

        <div className="mt-8 space-y-6">
          {distribution.map((choice) => (
            <div key={choice.value}>
              <div className="mb-3 flex items-center justify-between gap-4 text-sm">
                <div className="flex items-center gap-3">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${choice.color}`}
                  />

                  <span className="font-medium">
                    {choice.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 tabular-nums">
                  <span className="text-gray-500">
                    {choice.count} votes
                  </span>

                  <span className="w-14 text-right font-semibold">
                    {choice.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div
                className="h-3 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-label={`${choice.label} share of votes`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={choice.percentage}
              >
                <div
                  className={`h-full rounded-full ${choice.color}`}
                  style={{
                    width: `${choice.percentage}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-9 border-t border-white/10 pt-6">
          <p className="text-sm font-medium text-gray-300">
            Community insight
          </p>

          <p className="mt-2 text-sm leading-7 text-gray-400">
            {totalVotes > 0
              ? `${bothOrNeitherPercentage.toFixed(1)}% of votes selected either Both or Neither, showing how often the community evaluates both captions together rather than selecting only A or B.`
              : "Voting insights will appear once the community starts voting."}
          </p>
        </div>
      </section>
    </main>
  );
}
