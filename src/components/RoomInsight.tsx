import { AnalysisResult } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Info, Sparkles, Eye, Layers } from "lucide-react";

interface RoomInsightProps {
  analysis: AnalysisResult;
}

const RoomInsight = ({ analysis }: RoomInsightProps) => {
  const topStyle = analysis.possible_styles?.[0] || "Unknown";
  const styleScore = analysis.style_match_scores?.[topStyle];
  const confidence = styleScore ? Math.round(styleScore * 100) : 0;
  const aestheticPercent = Math.round((analysis.aesthetic_score || 0) * 10);
  const brightness = analysis.lighting?.brightness ?? (analysis as any).brightness ?? 0;
  const objects = analysis.objects || [];
  const recommendations = analysis.recommendations || [];
  const designMetrics = (analysis as any).design_metrics || {};

  return (
    <Card className="glass-card border-primary/20 orange-glow overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-4">
          <h2 className="font-display text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Room Analysis
          </h2>
          <p className="text-sm text-muted-foreground mt-1">AI-powered interior analysis results</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid md:grid-cols-3 gap-4 p-6 pt-2">
          {/* Style */}
          <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="text-2xl font-bold text-primary mb-1">{topStyle}</div>
            <div className="text-xs text-muted-foreground">Detected Style</div>
            <Badge variant="secondary" className="mt-2 bg-primary/10 text-primary border-primary/20">
              {confidence}% confidence
            </Badge>
          </div>

          {/* Score */}
          <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="text-4xl font-black text-primary mb-1">{aestheticPercent}%</div>
            <div className="text-xs text-muted-foreground">Aesthetic Score</div>
            <Progress value={aestheticPercent} className="mt-2 h-2" />
          </div>

          {/* Brightness */}
          <div className="text-center p-4 rounded-xl bg-muted/30 border border-border/30">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <span className="text-3xl font-bold text-foreground">{brightness}%</span>
            </div>
            <div className="text-xs text-muted-foreground">Brightness Level</div>
          </div>
        </div>

        {/* Detected Objects */}
        <div className="px-6 pb-4">
          <div className="font-semibold text-foreground mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Detected Items ({objects.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {objects.slice(0, 10).map((obj, i) => (
              <Badge key={i} variant="secondary" className="bg-muted/50 text-foreground border-border/30 capitalize">
                {obj.name || (obj as any).label}
                {obj.material && <span className="text-muted-foreground ml-1">({obj.material})</span>}
              </Badge>
            ))}
            {objects.length > 10 && (
              <Badge variant="outline" className="text-muted-foreground">+{objects.length - 10} more</Badge>
            )}
          </div>
        </div>

        {/* Design Metrics */}
        {Object.keys(designMetrics).length > 0 && (
          <div className="px-6 pb-4">
            <div className="font-semibold text-foreground mb-2">📊 Design Metrics</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(designMetrics).slice(0, 6).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-muted/20 border border-border/20 text-sm">
                  <span className="text-muted-foreground capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="font-medium text-foreground">{typeof value === "number" ? (value as number).toFixed(2) : String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Issues & Recommendations */}
        {recommendations.length > 0 && (
          <div className="px-6 pb-6">
            <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
              <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Info className="h-4 w-4 text-destructive" />
                Top Issues & Fixes
              </h4>
              <ul className="space-y-1.5">
                {recommendations.slice(0, 4).map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-destructive mt-0.5 shrink-0">⚠️</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RoomInsight;
