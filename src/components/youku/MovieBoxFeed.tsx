import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { getHomeFeed } from "@/lib/catalog.functions";
import { uniqueHomeFeed } from "@/lib/web-catalog-rules";
import { isAdultItem } from "@/lib/categories";
import { MediaCard } from "./MediaCard";
import { Button } from "@/components/ui/button";

export function MovieBoxFeed() {
  const sentinel = useRef<HTMLDivElement>(null);
  const feed = useInfiniteQuery({
    queryKey: ["moviebox-home-feed"], initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      try {
        const { fetchHomeFeed } = await import("@/lib/moviebox");
        return await fetchHomeFeed(pageParam);
      } catch { return getHomeFeed({ data: { page: pageParam } }); }
    },
    getNextPageParam: (last) => last.nextPage ?? undefined,
    staleTime: 60_000, retry: 1,
  });
  const { hasNextPage, isFetching, isError, fetchNextPage } = feed;
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage || isFetching || isError) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void fetchNextPage();
    }, { rootMargin: "600px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetching, isError, fetchNextPage]);
  const items = uniqueHomeFeed(feed.data?.pages ?? []).filter((item) => !isAdultItem(item));
  return <section aria-label="More from MovieBox" className="mt-8 pr-3 sm:pr-4 lg:pr-8">
    <h2 className="mb-3 text-lg font-bold text-foreground">More from MovieBox</h2>
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
      {items.map((item) => <MediaCard key={item.id} item={item} block />)}
    </div>
    <div ref={sentinel} className="flex min-h-20 items-center justify-center">
      {isFetching && <LoaderCircle aria-label="Loading more movies" className="size-6 animate-spin text-muted-foreground" />}
      {isError && <Button variant="secondary" onClick={() => void (feed.data ? fetchNextPage() : feed.refetch())}>Retry loading movies</Button>}
    </div>
  </section>;
}