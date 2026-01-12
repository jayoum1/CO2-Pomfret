"""
Streamlit Frontend for Carbon DBH Forest Simulation

Main features:
- Time slider for viewing forest snapshots
- Single tree predictor (user-designed tree)
- Planting scenario builder (main school impact feature)
"""

import streamlit as st
import pandas as pd
import requests
import json
from typing import Dict, List, Optional
import plotly.express as px
import plotly.graph_objects as go

# API base URL
API_BASE_URL = "http://localhost:8000"

# Page configuration
st.set_page_config(
    page_title="Pomfret Forest Simulation",
    page_icon="🌲",
    layout="wide"
)

# ============================================================================
# Helper Functions
# ============================================================================

def call_api(endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Dict:
    """Call the FastAPI backend"""
    url = f"{API_BASE_URL}{endpoint}"
    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=data)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        st.error("❌ Cannot connect to API. Make sure the FastAPI server is running:\n"
                "```bash\npython3 -m uvicorn src.api.app:app --host 0.0.0.0 --port 8000\n```")
        st.stop()
    except requests.exceptions.HTTPError as e:
        st.error(f"❌ API Error: {e}")
        st.stop()
    except Exception as e:
        st.error(f"❌ Error: {e}")
        st.stop()


# ============================================================================
# Main App
# ============================================================================

st.title("🌲 Pomfret Forest Growth & Carbon Simulation")
st.markdown("---")

# Sidebar navigation
page = st.sidebar.selectbox(
    "Navigation",
    ["Time Slider", "Single Tree Predictor", "Planting Scenarios"]
)

if page == "Time Slider":
    st.header("📊 Forest Snapshots Over Time")
    
    # Get available years
    years_data = call_api("/snapshots/years")
    available_years = years_data.get("years", [0, 5, 10, 20])
    
    if not available_years:
        st.warning("No snapshots available. Please generate snapshots first.")
    else:
        # Year selector
        selected_year = st.slider(
            "Years Ahead",
            min_value=min(available_years),
            max_value=max(available_years),
            value=0,
            step=5 if len(available_years) > 1 else 1
        )
        
        # Get summary
        summary = call_api(f"/summary?years_ahead={selected_year}")
        
        # Display metrics
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Total Carbon", f"{summary['total_carbon_kgC']:,.0f} kg C")
        with col2:
            st.metric("Mean DBH", f"{summary['mean_dbh_cm']:.1f} cm")
        with col3:
            st.metric("Number of Trees", f"{summary['num_trees']:,}")
        
        # Plot breakdown
        col1, col2 = st.columns(2)
        
        with col1:
            st.subheader("Carbon by Plot")
            plot_data = summary['plot_breakdown']
            plot_df = pd.DataFrame([
                {"Plot": plot, "Carbon (kg C)": data['carbon_at_time'], "Count": data['count']}
                for plot, data in plot_data.items()
            ])
            fig = px.bar(plot_df, x="Plot", y="Carbon (kg C)", color="Plot")
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            st.subheader("Top 10 Species by Carbon")
            species_data = summary['species_breakdown']
            species_df = pd.DataFrame([
                {"Species": species, "Carbon (kg C)": carbon}
                for species, carbon in list(species_data.items())[:10]
            ])
            fig = px.bar(species_df, x="Carbon (kg C)", y="Species", orientation='h')
            st.plotly_chart(fig, use_container_width=True)
        
        # DBH distribution
        snapshot = call_api(f"/snapshots?years_ahead={selected_year}")
        if snapshot['success']:
            df = pd.DataFrame(snapshot['data'])
            st.subheader("DBH Distribution")
            fig = px.histogram(df, x="DBH_cm", nbins=30, labels={"DBH_cm": "DBH (cm)"})
            st.plotly_chart(fig, use_container_width=True)

elif page == "Single Tree Predictor":
    st.header("🌳 Single Tree Predictor")
    st.markdown("Predict next-year DBH and carbon for a user-designed tree.")
    
    col1, col2 = st.columns(2)
    
    with col1:
        prev_dbh = st.number_input("Current DBH (cm)", min_value=0.1, value=25.0, step=0.1)
        plot = st.selectbox("Plot", ["Upper", "Middle", "Lower"])
        species = st.text_input("Species (optional)", value="red oak", help="Leave empty for generic hardwood/softwood")
        group_softw = st.radio("Group (if species not specified)", ["Hardwood", "Softwood"], horizontal=True) if not species else None
    
    with col2:
        st.info("""
        **Instructions:**
        - Enter current DBH in cm
        - Select plot location
        - Enter species name (or leave empty for generic)
        - Click Predict to see results
        """)
    
    if st.button("🔮 Predict", type="primary"):
        with st.spinner("Predicting..."):
            request_data = {
                "prev_dbh_cm": prev_dbh,
                "plot": plot,
                "species": species if species else None,
                "group_softw": group_softw == "Softwood" if group_softw else None
            }
            
            result = call_api("/predict/tree", method="POST", data=request_data)
            
            if result['success']:
                pred = result['prediction']
                
                st.success("✅ Prediction Complete!")
                
                col1, col2, col3 = st.columns(3)
                with col1:
                    st.metric("Next Year DBH", f"{pred['dbh_next_year_cm']:.2f} cm")
                with col2:
                    st.metric("DBH Growth", f"{pred['dbh_growth_cm']:.2f} cm/year")
                with col3:
                    st.metric("Carbon Growth", f"{pred['carbon_growth_kg']:.2f} kg C/year")
                
                st.markdown("---")
                st.subheader("Detailed Metrics")
                metrics_df = pd.DataFrame([
                    ["Current DBH", f"{pred['dbh_now_cm']:.2f} cm"],
                    ["Next Year DBH", f"{pred['dbh_next_year_cm']:.2f} cm"],
                    ["Current Carbon", f"{pred['carbon_now_kg']:.2f} kg C"],
                    ["Future Carbon", f"{pred['carbon_future_kg']:.2f} kg C"],
                    ["Carbon Growth", f"{pred['carbon_growth_kg']:.2f} kg C"],
                    ["Carbon Growth Rate", f"{pred['carbon_growth_rate']:.4f}"],
                    ["DBH Growth Rate", f"{pred['dbh_growth_rate']:.4f}"]
                ], columns=["Metric", "Value"])
                st.dataframe(metrics_df, use_container_width=True, hide_index=True)

elif page == "Planting Scenarios":
    st.header("🌱 Planting Scenario Builder")
    st.markdown("**Main School Impact Feature**: Compare baseline forest vs. forest with new plantings")
    
    # Mode selection
    mode = st.radio(
        "Scenario Mode",
        ["Recipe Mode", "Explicit Mode", "Preset Scenarios"],
        horizontal=True
    )
    
    st.markdown("---")
    
    if mode == "Recipe Mode":
        st.subheader("Recipe-Based Planting")
        st.markdown("Specify total count, species proportions, plot, and initial DBH")
        
        col1, col2 = st.columns(2)
        
        with col1:
            total_count = st.number_input("Total Trees to Plant", min_value=1, value=100, step=10)
            plot = st.selectbox("Plot", ["Upper", "Middle", "Lower"])
            initial_dbh = st.number_input("Initial DBH (cm)", min_value=0.1, value=5.0, step=0.1)
        
        with col2:
            st.subheader("Species Proportions")
            st.markdown("Proportions must sum to 1.0")
            
            # Common species
            species_list = [
                "red oak", "sugar maple", "white oak", "black oak",
                "white pine", "eastern hemlock", "yellow birch",
                "american beech", "black cherry", "red maple", "tulip poplar"
            ]
            
            proportions = {}
            remaining = 1.0
            
            for i, species in enumerate(species_list):
                if i == len(species_list) - 1:
                    # Last species gets remaining proportion
                    prop = st.number_input(
                        f"{species}",
                        min_value=0.0,
                        max_value=remaining,
                        value=0.0 if remaining < 0.01 else remaining,
                        step=0.01,
                        key=f"prop_{species}"
                    )
                    proportions[species] = prop
                else:
                    prop = st.number_input(
                        f"{species}",
                        min_value=0.0,
                        max_value=remaining,
                        value=0.0,
                        step=0.01,
                        key=f"prop_{species}"
                    )
                    proportions[species] = prop
                    remaining -= prop
            
            # Filter out zero proportions
            proportions = {k: v for k, v in proportions.items() if v > 0}
        
        years_list = st.multiselect(
            "Years to Simulate",
            [0, 5, 10, 20],
            default=[0, 5, 10, 20]
        )
        
        if st.button("🌲 Simulate Scenario", type="primary"):
            if not proportions:
                st.error("Please specify at least one species with non-zero proportion")
            elif abs(sum(proportions.values()) - 1.0) > 1e-6:
                st.error(f"Proportions sum to {sum(proportions.values()):.2f}, must sum to 1.0")
            elif not years_list:
                st.error("Please select at least one year to simulate")
            else:
                with st.spinner("Simulating scenario (this may take a minute)..."):
                    request_data = {
                        "total_count": total_count,
                        "species_proportions": proportions,
                        "plot": plot,
                        "initial_dbh_cm": initial_dbh,
                        "years_list": years_list
                    }
                    
                    result = call_api("/scenarios/planting/recipe", method="POST", data=request_data)
                    
                    if result['success']:
                        display_scenario_results(result, years_list)
    
    elif mode == "Explicit Mode":
        st.subheader("Explicit Tree List")
        st.markdown("Specify each tree individually")
        
        st.warning("⚠️ Explicit mode: Add trees one by one (or use preset scenarios)")
        
        num_trees = st.number_input("Number of Trees", min_value=1, max_value=50, value=5)
        
        trees = []
        for i in range(num_trees):
            with st.expander(f"Tree {i+1}"):
                col1, col2, col3 = st.columns(3)
                with col1:
                    species = st.text_input(f"Species", value="red oak", key=f"species_{i}")
                with col2:
                    plot = st.selectbox(f"Plot", ["Upper", "Middle", "Lower"], key=f"plot_{i}")
                with col3:
                    dbh = st.number_input(f"DBH (cm)", min_value=0.1, value=5.0, step=0.1, key=f"dbh_{i}")
                
                trees.append({"species": species, "plot": plot, "dbh_cm": dbh})
        
        years_list = st.multiselect(
            "Years to Simulate",
            [0, 5, 10, 20],
            default=[0, 5, 10, 20],
            key="explicit_years"
        )
        
        if st.button("🌲 Simulate Scenario", type="primary", key="explicit_simulate"):
            if not years_list:
                st.error("Please select at least one year to simulate")
            else:
                with st.spinner("Simulating scenario..."):
                    request_data = {
                        "trees": trees,
                        "years_list": years_list
                    }
                    
                    result = call_api("/scenarios/planting/explicit", method="POST", data=request_data)
                    
                    if result['success']:
                        display_scenario_results(result, years_list)
    
    elif mode == "Preset Scenarios":
        st.subheader("Preset Scenarios")
        
        # Load presets
        presets_data = call_api("/scenarios/presets")
        presets = presets_data.get("presets", [])
        
        if not presets:
            st.warning("No preset scenarios available")
        else:
            selected_preset = st.selectbox(
                "Select Preset",
                [p['name'] for p in presets]
            )
            
            # Get preset details
            preset_info = next(p for p in presets if p['name'] == selected_preset)
            preset_details = call_api(f"/scenarios/presets/{preset_info['filename']}")
            
            if preset_details['success']:
                scenario = preset_details['scenario']
                
                st.info(f"**{scenario.get('name')}**: {scenario.get('description', '')}")
                
                if scenario.get('mode') == 'recipe':
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("Total Trees", scenario['total_count'])
                    with col2:
                        st.metric("Plot", scenario['plot'])
                    with col3:
                        st.metric("Initial DBH", f"{scenario['initial_dbh_cm']} cm")
                    
                    st.markdown("**Species Mix:**")
                    species_df = pd.DataFrame([
                        {"Species": species, "Proportion": f"{prop*100:.1f}%", "Count": int(scenario['total_count'] * prop)}
                        for species, prop in scenario['species_proportions'].items()
                    ])
                    st.dataframe(species_df, use_container_width=True, hide_index=True)
                
                years_list = st.multiselect(
                    "Years to Simulate",
                    [0, 5, 10, 20],
                    default=[0, 5, 10, 20],
                    key="preset_years"
                )
                
                if st.button("🌲 Simulate Preset", type="primary"):
                    if not years_list:
                        st.error("Please select at least one year to simulate")
                    else:
                        with st.spinner("Simulating preset scenario..."):
                            result = call_api(
                                f"/scenarios/presets/{preset_info['filename']}/simulate",
                                method="POST",
                                data={"years_list": years_list}
                            )
                            
                            if result['success']:
                                display_scenario_results(result, years_list)


def display_scenario_results(result: Dict, years_list: List[int]):
    """Display scenario comparison results"""
    st.success("✅ Simulation Complete!")
    
    comparison = result['comparison']
    comparison_df = pd.DataFrame(comparison)
    
    st.markdown("---")
    st.subheader("📊 Scenario Comparison")
    
    # Key metrics
    col1, col2, col3, col4 = st.columns(4)
    final_year = max(years_list)
    final_row = comparison_df[comparison_df['years_ahead'] == final_year].iloc[0]
    
    with col1:
        st.metric(
            f"Carbon Added ({final_year} years)",
            f"{final_row['carbon_added']:,.0f} kg C",
            delta=f"{final_row['carbon_added']/final_row['baseline_total_carbon']*100:.1f}%"
        )
    with col2:
        st.metric(
            f"Total Carbon ({final_year} years)",
            f"{final_row['with_planting_total_carbon']:,.0f} kg C"
        )
    with col3:
        st.metric(
            "Trees Planted",
            f"{result['planting_trees_count']:,}"
        )
    with col4:
        st.metric(
            f"Mean DBH ({final_year} years)",
            f"{final_row['with_planting_mean_dbh']:.1f} cm"
        )
    
    # Comparison charts
    col1, col2 = st.columns(2)
    
    with col1:
        st.subheader("Total Carbon Over Time")
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=comparison_df['years_ahead'],
            y=comparison_df['baseline_total_carbon'],
            name='Baseline',
            line=dict(color='blue', width=2)
        ))
        fig.add_trace(go.Scatter(
            x=comparison_df['years_ahead'],
            y=comparison_df['with_planting_total_carbon'],
            name='With Planting',
            line=dict(color='green', width=2)
        ))
        fig.update_layout(
            xaxis_title="Years Ahead",
            yaxis_title="Total Carbon (kg C)",
            hovermode='x unified'
        )
        st.plotly_chart(fig, use_container_width=True)
    
    with col2:
        st.subheader("Carbon Added by New Trees")
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=comparison_df['years_ahead'],
            y=comparison_df['carbon_added'],
            name='Carbon Added',
            fill='tozeroy',
            line=dict(color='green', width=2)
        ))
        fig.update_layout(
            xaxis_title="Years Ahead",
            yaxis_title="Carbon Added (kg C)",
            hovermode='x unified'
        )
        st.plotly_chart(fig, use_container_width=True)
    
    # Detailed comparison table
    st.subheader("Detailed Comparison")
    display_df = comparison_df[[
        'years_ahead', 'baseline_total_carbon', 'with_planting_total_carbon',
        'carbon_added', 'baseline_mean_dbh', 'with_planting_mean_dbh',
        'planting_only_mean_dbh', 'baseline_num_trees', 'with_planting_num_trees'
    ]].copy()
    display_df.columns = [
        'Years', 'Baseline Carbon (kg C)', 'With Planting Carbon (kg C)',
        'Carbon Added (kg C)', 'Baseline Mean DBH (cm)', 'With Planting Mean DBH (cm)',
        'Planting Only Mean DBH (cm)', 'Baseline Trees', 'With Planting Trees'
    ]
    st.dataframe(display_df, use_container_width=True, hide_index=True)
    
    # Assumptions box
    st.info("""
    **Simulation Assumptions:**
    - Uses epsilon simulation rule (no shrinkage; negative deltas become near-zero growth)
    - No mortality modeled (growth-only baseline)
    - DBH in cm, Carbon in kg C
    """)


if __name__ == "__main__":
    st.markdown("---")
    st.markdown("**Note**: Make sure the FastAPI backend is running on port 8000")
